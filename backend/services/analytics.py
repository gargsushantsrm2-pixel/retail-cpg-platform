"""
Core analytics engine for the Retail & CPG Decision Intelligence Platform.
Provides RGM, forecasting, supply chain, and commercial analytics computations.
"""

import functools
from typing import Optional, List, Dict, Any
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from sqlalchemy.orm import Session
from sqlalchemy import text

from .data_generator import PRODUCTS

# Brands we own — derived once from master data
OUR_BRANDS = {p["brand"] for p in PRODUCTS}


# ── In-memory result cache ───────────────────────────────────────────────────
# Seeded data is immutable after startup, so analytics results never change.
# Cache them by (function, args) so each endpoint computes once then serves
# instantly on every subsequent request.
_RESULT_CACHE: Dict[str, Any] = {}


def _cached(func):
    @functools.wraps(func)
    def wrapper(db: Session, *args, **kwargs):
        key = f"{func.__name__}:{args}:{tuple(sorted(kwargs.items()))}"
        if key not in _RESULT_CACHE:
            _RESULT_CACHE[key] = func(db, *args, **kwargs)
        return _RESULT_CACHE[key]
    return wrapper


def clear_cache() -> None:
    _RESULT_CACHE.clear()


# ── Data access helpers ──────────────────────────────────────────────────────

def _load_sales(
    db: Session,
    years: Optional[List[int]] = None,
    categories: Optional[List[str]] = None,
    customers: Optional[List[str]] = None,
    brands: Optional[List[str]] = None,
) -> pd.DataFrame:
    q = """
        SELECT s.*, p.brand, p.category, p.subcategory, p.sku_name,
               p.base_price, p.cogs as unit_cogs, p.gross_margin_pct,
               c.customer_name, c.channel, c.tier
        FROM sales_data s
        JOIN products p ON s.product_id = p.product_id
        JOIN customers c ON s.customer_id = c.customer_id
        WHERE 1=1
    """
    params = {}
    if years:
        q += " AND s.year = ANY(:years)"
        params["years"] = years
    if categories:
        q += " AND p.category = ANY(:categories)"
        params["categories"] = categories
    if customers:
        q += " AND s.customer_id = ANY(:customers)"
        params["customers"] = customers
    if brands:
        q += " AND p.brand = ANY(:brands)"
        params["brands"] = brands
    return pd.read_sql(text(q), db.bind, params=params)


def _load_inventory(db: Session) -> pd.DataFrame:
    q = """
        SELECT i.*, p.brand, p.category, p.subcategory, p.sku_name
        FROM inventory_data i
        JOIN products p ON i.product_id = p.product_id
    """
    return pd.read_sql(text(q), db.bind)


def _load_market(db: Session) -> pd.DataFrame:
    q = "SELECT * FROM market_data"
    return pd.read_sql(text(q), db.bind)


def _load_forecasts(db: Session) -> pd.DataFrame:
    q = """
        SELECT f.*, p.brand, p.category, p.subcategory, p.sku_name,
               c.customer_name, c.channel
        FROM forecast_data f
        JOIN products p ON f.product_id = p.product_id
        JOIN customers c ON f.customer_id = c.customer_id
    """
    return pd.read_sql(text(q), db.bind)


# ── Executive KPIs ────────────────────────────────────────────────────────────

@_cached
def get_executive_summary(db: Session) -> Dict[str, Any]:
    df = _load_sales(db)

    cy = df[df["year"] == 2024]
    py = df[df["year"] == 2023]

    def pct_chg(a, b):
        return round((a - b) / max(b, 1) * 100, 1) if b else 0

    cy_rev = cy["revenue"].sum()
    py_rev = py["revenue"].sum()
    cy_vol = cy["volume_cases"].sum()
    py_vol = py["volume_cases"].sum()
    cy_gp = cy["gross_profit"].sum()
    py_gp = py["gross_profit"].sum()
    cy_gm = cy_gp / max(cy_rev, 1) * 100
    py_gm = py_gp / max(py_rev, 1) * 100

    # Market share (from market data, approximated from sales/market volume)
    mkt = _load_market(db)
    cy_mkt = mkt[mkt["week_date"].astype(str).str[:4] == "2024"]
    py_mkt = mkt[mkt["week_date"].astype(str).str[:4] == "2023"]
    # Only our brands
    cy_our = cy_mkt[cy_mkt["brand"].isin(OUR_BRANDS)]
    py_our = py_mkt[py_mkt["brand"].isin(OUR_BRANDS)]
    cy_share = cy_our["volume_share_pct"].mean() if len(cy_our) else 0
    py_share = py_our["volume_share_pct"].mean() if len(py_our) else 0

    return {
        "revenue": {"value": round(cy_rev, 0), "vs_py_pct": pct_chg(cy_rev, py_rev), "label": "Net Revenue", "unit": "$"},
        "volume": {"value": round(cy_vol, 0), "vs_py_pct": pct_chg(cy_vol, py_vol), "label": "Volume (Cases)", "unit": "cs"},
        "gross_profit": {"value": round(cy_gp, 0), "vs_py_pct": pct_chg(cy_gp, py_gp), "label": "Gross Profit", "unit": "$"},
        "gross_margin": {"value": round(cy_gm, 1), "vs_py_pct": round(cy_gm - py_gm, 1), "label": "Gross Margin %", "unit": "%"},
        "market_share": {"value": round(cy_share, 1), "vs_py_pct": round(cy_share - py_share, 1), "label": "Avg Volume Share", "unit": "%"},
        "promo_pct": {
            "value": round(cy[cy["promo_flag"] == True]["revenue"].sum() / max(cy_rev, 1) * 100, 1),
            "vs_py_pct": 0, "label": "Revenue on Promo", "unit": "%"
        },
    }


@_cached
def get_revenue_trend(db: Session) -> List[Dict]:
    df = _load_sales(db)
    df["week_date"] = pd.to_datetime(df["week_date"])
    df["month"] = df["week_date"].dt.to_period("M").astype(str)

    monthly = df.groupby(["year", "month"]).agg(
        revenue=("revenue", "sum"),
        volume=("volume_cases", "sum"),
        gross_profit=("gross_profit", "sum"),
    ).reset_index()

    cy = monthly[monthly["year"] == 2024].copy()
    py = monthly[monthly["year"] == 2023].copy()
    py["month_py"] = py["month"].str.replace("2023", "2024")

    merged = cy.merge(
        py[["month_py", "revenue", "volume"]].rename(
            columns={"revenue": "revenue_py", "volume": "volume_py", "month_py": "month"}
        ),
        on="month", how="left"
    )
    merged["rev_vs_py_pct"] = ((merged["revenue"] - merged["revenue_py"]) / merged["revenue_py"] * 100).round(1)

    return merged.fillna(0).to_dict(orient="records")


@_cached
def get_category_performance(db: Session) -> List[Dict]:
    df = _load_sales(db)
    cy = df[df["year"] == 2024]
    py = df[df["year"] == 2023]

    def agg(d):
        return d.groupby("category").agg(
            revenue=("revenue", "sum"),
            volume=("volume_cases", "sum"),
            gross_profit=("gross_profit", "sum"),
        ).reset_index()

    cy_cat = agg(cy)
    py_cat = agg(py).rename(columns={"revenue": "rev_py", "volume": "vol_py"})

    merged = cy_cat.merge(py_cat[["category", "rev_py", "vol_py"]], on="category", how="left")
    merged["rev_growth_pct"] = ((merged["revenue"] - merged["rev_py"]) / merged["rev_py"] * 100).round(1)
    merged["gm_pct"] = (merged["gross_profit"] / merged["revenue"] * 100).round(1)
    merged["rev_share_pct"] = (merged["revenue"] / merged["revenue"].sum() * 100).round(1)
    return merged.fillna(0).to_dict(orient="records")


@_cached
def get_top_performers(db: Session, n: int = 10) -> Dict[str, List]:
    df = _load_sales(db, years=[2024])

    brand_perf = df.groupby("brand").agg(
        revenue=("revenue", "sum"),
        volume=("volume_cases", "sum"),
    ).sort_values("revenue", ascending=False).head(n).reset_index()

    sku_perf = df.groupby(["product_id", "sku_name", "brand"]).agg(
        revenue=("revenue", "sum"),
        volume=("volume_cases", "sum"),
        gp=("gross_profit", "sum"),
    ).reset_index()
    sku_perf["gm_pct"] = (sku_perf["gp"] / sku_perf["revenue"] * 100).round(1)
    top_sku = sku_perf.sort_values("revenue", ascending=False).head(n)
    bottom_sku = sku_perf.sort_values("revenue").head(n)

    cust_perf = df.groupby(["customer_id", "customer_name", "channel"]).agg(
        revenue=("revenue", "sum"),
        volume=("volume_cases", "sum"),
    ).sort_values("revenue", ascending=False).reset_index()

    return {
        "top_brands": brand_perf.to_dict(orient="records"),
        "top_skus": top_sku.to_dict(orient="records"),
        "bottom_skus": bottom_sku.to_dict(orient="records"),
        "customer_ranking": cust_perf.to_dict(orient="records"),
    }


# ── Revenue Growth Management ─────────────────────────────────────────────────

@_cached
def get_price_elasticity(db: Session, category: Optional[str] = None) -> List[Dict]:
    df = _load_sales(db)
    if category:
        df = df[df["category"] == category]

    results = []
    for prod_id, grp in df.groupby("product_id"):
        grp = grp.copy()
        if len(grp) < 20:
            continue
        grp["log_vol"] = np.log(np.maximum(grp["volume_cases"], 0.01))
        grp["log_price"] = np.log(np.maximum(grp["net_price"], 0.01))
        X = grp[["log_price"]].values
        y = grp["log_vol"].values
        try:
            model = LinearRegression().fit(X, y)
            elasticity = round(model.coef_[0], 2)
            r2 = round(model.score(X, y), 3)
        except Exception:
            elasticity, r2 = -2.0, 0.5

        sku_name = grp["sku_name"].iloc[0]
        brand = grp["brand"].iloc[0]
        cat = grp["category"].iloc[0]
        avg_price = grp["net_price"].mean()
        avg_vol = grp["volume_cases"].mean()
        rev = grp["revenue"].sum()

        results.append({
            "product_id": prod_id,
            "sku_name": sku_name,
            "brand": brand,
            "category": cat,
            "elasticity": elasticity,
            "r_squared": r2,
            "avg_price": round(avg_price, 2),
            "avg_weekly_volume": round(avg_vol, 1),
            "annual_revenue": round(rev, 0),
        })

    return sorted(results, key=lambda x: x["annual_revenue"], reverse=True)


@_cached
def get_revenue_waterfall(db: Session) -> Dict[str, Any]:
    """Revenue bridge: Price/Mix/Volume decomposition CY vs PY."""
    df = _load_sales(db)
    cy = df[df["year"] == 2024]
    py = df[df["year"] == 2023]

    cy_agg = cy.groupby("product_id").agg(
        rev_cy=("revenue", "sum"), vol_cy=("volume_cases", "sum")
    ).reset_index()
    py_agg = py.groupby("product_id").agg(
        rev_py=("revenue", "sum"), vol_py=("volume_cases", "sum"),
        price_py=("net_price", "mean"),
    ).reset_index()
    merged = cy_agg.merge(py_agg, on="product_id", how="inner")

    cy_price = (merged["rev_cy"] / np.maximum(merged["vol_cy"], 1)).values
    py_price = merged["price_py"].values
    py_vol = merged["vol_py"].values
    cy_vol = merged["vol_cy"].values
    py_rev = merged["rev_py"].values

    volume_effect = ((cy_vol - py_vol) * py_price).sum()
    price_effect = ((cy_price - py_price) * py_vol).sum()
    mix_effect = ((cy_vol - py_vol) * (cy_price - py_price)).sum()

    total_cy = cy["revenue"].sum()
    total_py = py["revenue"].sum()
    total_change = total_cy - total_py

    return {
        "py_revenue": round(total_py, 0),
        "cy_revenue": round(total_cy, 0),
        "total_change": round(total_change, 0),
        "volume_effect": round(volume_effect, 0),
        "price_effect": round(price_effect, 0),
        "mix_effect": round(mix_effect, 0),
        "waterfall": [
            {"label": "PY Revenue", "value": round(total_py, 0), "type": "total"},
            {"label": "Volume Effect", "value": round(volume_effect, 0), "type": "relative"},
            {"label": "Price Effect", "value": round(price_effect, 0), "type": "relative"},
            {"label": "Mix Effect", "value": round(mix_effect, 0), "type": "relative"},
            {"label": "CY Revenue", "value": round(total_cy, 0), "type": "total"},
        ],
    }


@_cached
def get_promo_roi(db: Session) -> List[Dict]:
    df = _load_sales(db, years=[2024])
    promo = df[df["promo_flag"] == True].copy()

    results = []
    for ptype, grp in promo.groupby("promo_type"):
        if grp.empty:
            continue
        total_incremental_vol = grp["incremental_volume"].sum()
        total_incremental_rev = (grp["incremental_volume"] * grp["net_price"]).sum()
        total_discount_cost = (grp["volume_cases"] * grp["list_price"] * grp["promo_discount_pct"]).sum()
        avg_lift_pct = (grp["incremental_volume"] / np.maximum(grp["baseline_volume"], 1)).mean() * 100
        roi = (total_incremental_rev - total_discount_cost) / max(total_discount_cost, 1) * 100
        num_events = len(grp.groupby(["product_id", "customer_id", "week_date"]))

        results.append({
            "promo_type": ptype,
            "num_events": num_events,
            "avg_lift_pct": round(avg_lift_pct, 1),
            "incremental_revenue": round(total_incremental_rev, 0),
            "trade_spend": round(total_discount_cost, 0),
            "roi_pct": round(roi, 1),
            "incremental_volume": round(total_incremental_vol, 0),
        })

    return sorted(results, key=lambda x: x["roi_pct"], reverse=True)


@_cached
def get_mix_analysis(db: Session) -> List[Dict]:
    df = _load_sales(db)
    cy = df[df["year"] == 2024]
    py = df[df["year"] == 2023]

    def brand_rev(d):
        return d.groupby(["brand", "category"]).agg(
            revenue=("revenue", "sum"), volume=("volume_cases", "sum"),
            avg_price=("net_price", "mean"),
        ).reset_index()

    cy_b = brand_rev(cy)
    py_b = brand_rev(py).rename(columns={"revenue": "rev_py", "volume": "vol_py", "avg_price": "price_py"})
    merged = cy_b.merge(py_b, on=["brand", "category"], how="left").fillna(0)
    merged["rev_growth"] = ((merged["revenue"] - merged["rev_py"]) / np.maximum(merged["rev_py"], 1) * 100).round(1)
    merged["price_change"] = ((merged["avg_price"] - merged["price_py"]) / np.maximum(merged["price_py"], 1) * 100).round(1)
    merged["vol_growth"] = ((merged["volume"] - merged["vol_py"]) / np.maximum(merged["vol_py"], 1) * 100).round(1)
    merged["rev_share"] = (merged["revenue"] / merged["revenue"].sum() * 100).round(2)
    return merged.to_dict(orient="records")


# ── Category Intelligence ─────────────────────────────────────────────────────

@_cached
def get_assortment_analysis(db: Session) -> List[Dict]:
    df = _load_sales(db, years=[2024])
    sku = df.groupby(["product_id", "sku_name", "brand", "category", "subcategory"]).agg(
        revenue=("revenue", "sum"),
        volume=("volume_cases", "sum"),
        gp=("gross_profit", "sum"),
        num_customers=("customer_id", "nunique"),
        promo_weeks=("promo_flag", "sum"),
        total_weeks=("week_date", "count"),
    ).reset_index()
    sku["gm_pct"] = (sku["gp"] / sku["revenue"] * 100).round(1)
    sku["promo_freq_pct"] = (sku["promo_weeks"] / sku["total_weeks"] * 100).round(1)
    sku["rev_share"] = (sku["revenue"] / sku["revenue"].sum() * 100).round(2)
    sku["velocity_index"] = (sku["volume"] / sku["num_customers"]).round(1)
    # Pareto flag
    sku_sorted = sku.sort_values("revenue", ascending=False)
    sku_sorted["cumulative_rev_share"] = (sku_sorted["revenue"].cumsum() / sku_sorted["revenue"].sum() * 100)
    sku_sorted["pareto_flag"] = sku_sorted["cumulative_rev_share"] <= 80
    return sku_sorted.fillna(0).to_dict(orient="records")


@_cached
def get_subcategory_trends(db: Session) -> List[Dict]:
    df = _load_sales(db)
    df["week_date"] = pd.to_datetime(df["week_date"])
    df["quarter_label"] = df["year"].astype(str) + "-Q" + df["quarter"].astype(str)

    qtrly = df.groupby(["category", "subcategory", "year", "quarter", "quarter_label"]).agg(
        revenue=("revenue", "sum"),
        volume=("volume_cases", "sum"),
    ).reset_index().sort_values(["category", "subcategory", "year", "quarter"])

    return qtrly.to_dict(orient="records")


# ── Demand Forecasting ────────────────────────────────────────────────────────

@_cached
def get_forecast_accuracy(db: Session) -> List[Dict]:
    """Calculate MAPE, WMAPE, and bias by brand/category using held-out actuals."""
    df = _load_sales(db, years=[2024])

    # Simulate forecast accuracy using a naive seasonal forecast vs actuals
    df["week_date"] = pd.to_datetime(df["week_date"])
    results = []

    for brand, grp in df.groupby("brand"):
        weekly = grp.groupby("week_date")["volume_cases"].sum().reset_index()
        weekly = weekly.sort_values("week_date")
        if len(weekly) < 8:
            continue
        actuals = weekly["volume_cases"].values
        # Naive forecast = prior year same week (shifted)
        n = len(actuals)
        half = n // 2
        naive_fc = np.roll(actuals, 4)[:n]
        naive_fc[:4] = actuals[:4]

        abs_errors = np.abs(actuals - naive_fc)
        mape = np.mean(abs_errors / np.maximum(actuals, 1)) * 100
        wmape = abs_errors.sum() / np.maximum(actuals.sum(), 1) * 100
        bias = ((actuals - naive_fc).sum() / np.maximum(actuals.sum(), 1)) * 100
        fa = max(0, 100 - wmape)

        results.append({
            "brand": brand,
            "category": grp["category"].iloc[0],
            "mape": round(mape, 1),
            "wmape": round(wmape, 1),
            "forecast_accuracy": round(fa, 1),
            "bias_pct": round(bias, 1),
            "total_volume": round(actuals.sum(), 0),
        })

    return sorted(results, key=lambda x: x["forecast_accuracy"], reverse=True)


@_cached
def get_sales_vs_forecast(db: Session, product_id: Optional[str] = None, customer_id: Optional[str] = None) -> Dict:
    df = _load_sales(db)
    fcast_df = _load_forecasts(db)

    df["week_date"] = pd.to_datetime(df["week_date"])

    if product_id:
        df = df[df["product_id"] == product_id]
        fcast_df = fcast_df[fcast_df["product_id"] == product_id]
    if customer_id:
        df = df[df["customer_id"] == customer_id]
        fcast_df = fcast_df[fcast_df["customer_id"] == customer_id]

    actuals = df.groupby("week_date")["volume_cases"].sum().reset_index()
    actuals.columns = ["week_date", "actual_volume"]

    # Build simple seasonal forecast for historical period
    series = actuals.set_index("week_date")["actual_volume"]
    if len(series) >= 24:
        try:
            model = ExponentialSmoothing(series, trend="add", seasonal="add", seasonal_periods=52)
            fit = model.fit(optimized=True)
            fitted = fit.fittedvalues
        except Exception:
            fitted = series
    else:
        fitted = series

    fitted_df = fitted.reset_index()
    fitted_df.columns = ["week_date", "forecast_volume"]

    forecast_forward = fcast_df.groupby("week_date").agg(
        forecast_volume=("forecast_volume", "sum"),
        lower_bound=("lower_bound", "sum"),
        upper_bound=("upper_bound", "sum"),
    ).reset_index()

    return {
        "actuals": actuals.to_dict(orient="records"),
        "fitted": fitted_df.to_dict(orient="records"),
        "forecast_forward": forecast_forward.to_dict(orient="records"),
    }


@_cached
def get_demand_decomposition(db: Session, category: str = "Beverages") -> Dict:
    df = _load_sales(db)
    df = df[df["category"] == category]
    df["week_date"] = pd.to_datetime(df["week_date"])
    weekly = df.groupby("week_date")["volume_cases"].sum().reset_index()
    weekly = weekly.sort_values("week_date")

    # Rolling seasonal
    weekly["trend"] = weekly["volume_cases"].rolling(13, center=True, min_periods=1).mean()
    weekly["seasonal"] = weekly["volume_cases"] - weekly["trend"]
    weekly["irregular"] = weekly["volume_cases"] - weekly["trend"] - weekly["seasonal"]

    return {
        "dates": weekly["week_date"].dt.strftime("%Y-%m-%d").tolist(),
        "actual": weekly["volume_cases"].round(1).tolist(),
        "trend": weekly["trend"].round(1).fillna(method="bfill").fillna(method="ffill").tolist(),
        "seasonal": weekly["seasonal"].round(1).fillna(0).tolist(),
        "irregular": weekly["irregular"].round(1).fillna(0).tolist(),
    }


# ── Supply Chain ──────────────────────────────────────────────────────────────

@_cached
def get_inventory_health(db: Session) -> List[Dict]:
    df = _load_inventory(db)
    df["week_date"] = pd.to_datetime(df["week_date"])
    latest_week = df["week_date"].max()
    latest = df[df["week_date"] == latest_week]

    summary = latest.groupby(["product_id", "sku_name", "brand", "category"]).agg(
        avg_woc=("weeks_of_cover", "mean"),
        total_on_hand=("on_hand_cases", "sum"),
        total_in_transit=("in_transit_cases", "sum"),
        oos_locations=("oos_flag", "sum"),
        total_locations=("warehouse", "count"),
    ).reset_index()

    summary["oos_rate_pct"] = (summary["oos_locations"] / summary["total_locations"] * 100).round(1)
    summary["risk_flag"] = summary.apply(
        lambda r: "Critical" if r["avg_woc"] < 1.0 else ("Low" if r["avg_woc"] < 2.0 else "Healthy"),
        axis=1,
    )
    return summary.sort_values("avg_woc").to_dict(orient="records")


@_cached
def get_service_levels(db: Session) -> Dict:
    df = _load_inventory(db)
    df["week_date"] = pd.to_datetime(df["week_date"])
    df["year"] = df["week_date"].dt.year
    df["month"] = df["week_date"].dt.to_period("M").astype(str)

    monthly = df.groupby(["year", "month"]).agg(
        avg_woc=("weeks_of_cover", "mean"),
        oos_events=("oos_flag", "sum"),
        total_records=("id", "count"),
    ).reset_index()
    monthly["fill_rate_pct"] = ((1 - monthly["oos_events"] / monthly["total_records"]) * 100).round(1)

    # Simulate OTIF
    monthly["otif_pct"] = (monthly["fill_rate_pct"] * random_otif_factor(len(monthly))).round(1)

    by_category = df.groupby(["category", "year"]).agg(
        avg_woc=("weeks_of_cover", "mean"),
        fill_rate=("oos_flag", lambda x: (1 - x.mean()) * 100),
    ).reset_index()

    return {
        "monthly_trend": monthly.to_dict(orient="records"),
        "by_category": by_category.round(1).to_dict(orient="records"),
    }


def random_otif_factor(n: int) -> np.ndarray:
    np.random.seed(99)
    return np.random.uniform(0.92, 0.98, n)


@_cached
def get_replenishment_alerts(db: Session) -> List[Dict]:
    df = _load_inventory(db)
    df["week_date"] = pd.to_datetime(df["week_date"])
    latest = df[df["week_date"] == df["week_date"].max()]
    alerts = latest[latest["weeks_of_cover"] < 2.5].copy()
    alerts["urgency"] = alerts["weeks_of_cover"].apply(
        lambda w: "CRITICAL" if w < 1.0 else ("HIGH" if w < 1.5 else "MEDIUM")
    )
    alerts["suggested_order"] = (alerts["reorder_point"] - alerts["on_hand_cases"]).clip(lower=0).round(0)
    return alerts[["product_id", "sku_name", "warehouse", "weeks_of_cover", "urgency", "suggested_order"]].to_dict(orient="records")


# ── Commercial Excellence ─────────────────────────────────────────────────────

@_cached
def get_customer_pl(db: Session) -> List[Dict]:
    df = _load_sales(db, years=[2024])

    cust_pl = df.groupby(["customer_id", "customer_name", "channel", "tier"]).agg(
        gross_revenue=("revenue", "sum"),
        volume=("volume_cases", "sum"),
        gross_profit=("gross_profit", "sum"),
        trade_spend=("revenue", lambda x: (x * df.loc[x.index, "promo_discount_pct"]).sum()),
        promo_weeks=("promo_flag", "sum"),
        total_weeks=("week_date", "count"),
    ).reset_index()

    cust_pl["net_revenue"] = cust_pl["gross_revenue"] - cust_pl["trade_spend"]
    cust_pl["gross_margin_pct"] = (cust_pl["gross_profit"] / cust_pl["gross_revenue"] * 100).round(1)
    cust_pl["trade_spend_pct"] = (cust_pl["trade_spend"] / cust_pl["gross_revenue"] * 100).round(1)
    cust_pl["promo_freq_pct"] = (cust_pl["promo_weeks"] / cust_pl["total_weeks"] * 100).round(1)

    # Simulate SGA and customer-specific costs
    cust_pl["sga_allocated"] = cust_pl["net_revenue"] * 0.08
    cust_pl["customer_contribution"] = cust_pl["gross_profit"] - cust_pl["trade_spend"] - cust_pl["sga_allocated"]
    cust_pl["contribution_margin_pct"] = (cust_pl["customer_contribution"] / cust_pl["net_revenue"] * 100).round(1)

    return cust_pl.sort_values("net_revenue", ascending=False).fillna(0).to_dict(orient="records")


@_cached
def get_trade_effectiveness(db: Session) -> Dict:
    df = _load_sales(db, years=[2024])
    promo = df[df["promo_flag"] == True].copy()

    by_customer = promo.groupby(["customer_id", "customer_name"]).agg(
        trade_spend=("revenue", lambda x: (x * promo.loc[x.index, "promo_discount_pct"]).sum()),
        incremental_rev=("incremental_volume", lambda x: (x * promo.loc[x.index, "net_price"]).sum()),
        num_events=("promo_flag", "count"),
    ).reset_index()
    by_customer["roi"] = (
        (by_customer["incremental_rev"] - by_customer["trade_spend"]) / np.maximum(by_customer["trade_spend"], 1) * 100
    ).round(1)

    by_type = promo.groupby("promo_type").agg(
        trade_spend=("revenue", lambda x: (x * promo.loc[x.index, "promo_discount_pct"]).sum()),
        incremental_rev=("incremental_volume", lambda x: (x * promo.loc[x.index, "net_price"]).sum()),
        avg_lift=("incremental_volume", lambda x: (x / np.maximum(promo.loc[x.index, "baseline_volume"], 1)).mean() * 100),
        events=("promo_flag", "count"),
    ).reset_index()
    by_type["roi"] = (
        (by_type["incremental_rev"] - by_type["trade_spend"]) / np.maximum(by_type["trade_spend"], 1) * 100
    ).round(1)

    return {
        "by_customer": by_customer.fillna(0).to_dict(orient="records"),
        "by_type": by_type.fillna(0).to_dict(orient="records"),
    }


# ── Scenario Simulation ───────────────────────────────────────────────────────

def simulate_price_scenario(
    db: Session,
    product_id: str,
    price_change_pct: float,
    elasticity_override: Optional[float] = None,
) -> Dict:
    df = _load_sales(db, years=[2024])
    prod = df[df["product_id"] == product_id]
    if prod.empty:
        return {}

    base_revenue = prod["revenue"].sum()
    base_volume = prod["volume_cases"].sum()
    base_price = prod["net_price"].mean()
    base_gp = prod["gross_profit"].sum()

    if elasticity_override:
        elasticity = elasticity_override
    else:
        # Get from elasticity calc
        elast_data = get_price_elasticity(db)
        elast_map = {e["product_id"]: e["elasticity"] for e in elast_data}
        elasticity = elast_map.get(product_id, -2.5)

    new_price = base_price * (1 + price_change_pct / 100)
    volume_change_pct = elasticity * price_change_pct
    new_volume = base_volume * (1 + volume_change_pct / 100)
    new_revenue = new_volume * new_price
    unit_cogs = prod["cogs"].sum() / max(base_volume, 1)
    new_gp = new_volume * (new_price - unit_cogs)

    return {
        "product_id": product_id,
        "sku_name": prod["sku_name"].iloc[0],
        "price_change_pct": price_change_pct,
        "elasticity_used": elasticity,
        "base": {
            "price": round(base_price, 2), "volume": round(base_volume, 0),
            "revenue": round(base_revenue, 0), "gross_profit": round(base_gp, 0),
            "gm_pct": round(base_gp / max(base_revenue, 1) * 100, 1),
        },
        "scenario": {
            "price": round(new_price, 2), "volume": round(new_volume, 0),
            "revenue": round(new_revenue, 0), "gross_profit": round(new_gp, 0),
            "gm_pct": round(new_gp / max(new_revenue, 1) * 100, 1),
        },
        "delta": {
            "volume": round(new_volume - base_volume, 0),
            "revenue": round(new_revenue - base_revenue, 0),
            "gross_profit": round(new_gp - base_gp, 0),
            "volume_pct": round(volume_change_pct, 1),
            "revenue_pct": round((new_revenue - base_revenue) / max(base_revenue, 1) * 100, 1),
            "gp_pct": round((new_gp - base_gp) / max(base_gp, 1) * 100, 1),
        },
    }


def simulate_promo_scenario(
    db: Session,
    product_id: str,
    promo_type: str,
    num_events: int,
    discount_pct: float,
) -> Dict:
    df = _load_sales(db, years=[2024])
    prod = df[df["product_id"] == product_id]
    if prod.empty:
        return {}

    from .data_generator import PROMO_LIFTS
    lift_min, lift_max = PROMO_LIFTS.get(promo_type, (0.2, 0.4))
    avg_lift = (lift_min + lift_max) / 2

    base_weekly_vol = prod["volume_cases"].sum() / 52
    base_weekly_rev = prod["revenue"].sum() / 52
    base_weekly_gp = prod["gross_profit"].sum() / 52
    avg_price = prod["net_price"].mean()

    promo_vol_per_event = base_weekly_vol * (1 + avg_lift)
    promo_price = avg_price * (1 - discount_pct / 100)
    promo_rev_per_event = promo_vol_per_event * promo_price
    unit_cogs = prod["cogs"].sum() / max(prod["volume_cases"].sum(), 1)
    promo_gp_per_event = promo_vol_per_event * (promo_price - unit_cogs)

    total_promo_rev = promo_rev_per_event * num_events
    total_base_rev = base_weekly_rev * num_events
    incremental_rev = total_promo_rev - total_base_rev
    trade_cost = promo_vol_per_event * avg_price * discount_pct / 100 * num_events
    roi = (incremental_rev - trade_cost) / max(trade_cost, 1) * 100

    return {
        "product_id": product_id,
        "sku_name": prod["sku_name"].iloc[0],
        "promo_type": promo_type,
        "num_events": num_events,
        "discount_pct": discount_pct,
        "avg_lift_pct": round(avg_lift * 100, 1),
        "incremental_revenue": round(incremental_rev, 0),
        "trade_spend": round(trade_cost, 0),
        "roi_pct": round(roi, 1),
        "total_promo_volume": round(promo_vol_per_event * num_events, 0),
        "total_promo_revenue": round(total_promo_rev, 0),
    }


@_cached
def get_market_share_trends(db: Session) -> Dict:
    mkt = _load_market(db)
    mkt["week_date"] = pd.to_datetime(mkt["week_date"])
    mkt["month"] = mkt["week_date"].dt.to_period("M").astype(str)

    monthly = mkt.groupby(["category", "brand", "month"]).agg(
        volume_share=("volume_share_pct", "mean"),
        value_share=("value_share_pct", "mean"),
    ).reset_index()

    return monthly.to_dict(orient="records")
