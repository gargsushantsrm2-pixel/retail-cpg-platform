"""
Synthetic data generator for the Retail & CPG Decision Intelligence Platform.
Generates realistic 2-year weekly data for 50 SKUs, 10 customers, with
proper seasonality, price elasticity, and promotional patterns.
"""

import random
import math
from datetime import date, timedelta
from typing import List, Dict, Tuple
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from ..models.entities import Product, Customer, SalesData, InventoryData, MarketData, ForecastData

random.seed(42)
np.random.seed(42)

# ── Master data definitions ─────────────────────────────────────────────────

PRODUCTS = [
    # Beverages – 2 SKUs
    {"id": "BEV-001", "name": "BrewMaster Premium Coffee 24x12oz", "brand": "BrewMaster", "category": "Beverages", "subcategory": "Coffee", "pack": "24x12oz", "price": 38.40, "cogs": 22.10, "elasticity": -2.8},
    {"id": "BEV-003", "name": "VoltEdge Energy 24x16oz", "brand": "VoltEdge", "category": "Beverages", "subcategory": "Energy", "pack": "24x16oz", "price": 45.60, "cogs": 20.80, "elasticity": -2.3},
    # Snacks – 2 SKUs
    {"id": "SNK-001", "name": "CrunchCraft Kettle Chips 12x8oz", "brand": "CrunchCraft", "category": "Snacks", "subcategory": "Chips", "pack": "12x8oz", "price": 34.80, "cogs": 15.60, "elasticity": -2.2},
    {"id": "SNK-005", "name": "NutHouse Mixed Nuts 12x10oz", "brand": "NutHouse", "category": "Snacks", "subcategory": "Nuts", "pack": "12x10oz", "price": 58.80, "cogs": 38.40, "elasticity": -1.7},
    # Personal Care – 2 SKUs
    {"id": "PC-001", "name": "LuxeShine Shampoo 6x33.8oz", "brand": "LuxeShine", "category": "Personal Care", "subcategory": "Hair Care", "pack": "6x33.8oz", "price": 48.00, "cogs": 19.20, "elasticity": -1.6},
    {"id": "PC-003", "name": "FreshGuard Deodorant 12x2.7oz", "brand": "FreshGuard", "category": "Personal Care", "subcategory": "Deodorant", "pack": "12x2.7oz", "price": 36.00, "cogs": 13.20, "elasticity": -1.8},
    # Household – 2 SKUs
    {"id": "HH-001", "name": "TidePro Laundry Pods 4x81ct", "brand": "TidePro", "category": "Household", "subcategory": "Laundry", "pack": "4x81ct", "price": 76.80, "cogs": 38.40, "elasticity": -2.0},
    {"id": "HH-003", "name": "BrightClean All-Purpose 6x32oz", "brand": "BrightClean", "category": "Household", "subcategory": "Cleaning", "pack": "6x32oz", "price": 24.00, "cogs": 9.60, "elasticity": -2.4},
    # Dairy – 2 SKUs
    {"id": "DAI-001", "name": "CreekFarm Greek Yogurt 12x32oz", "brand": "CreekFarm", "category": "Dairy", "subcategory": "Yogurt", "pack": "12x32oz", "price": 55.20, "cogs": 34.80, "elasticity": -1.8},
    {"id": "DAI-003", "name": "AlpineGold Cheddar 12x32oz", "brand": "AlpineGold", "category": "Dairy", "subcategory": "Cheese", "pack": "12x32oz", "price": 84.00, "cogs": 58.80, "elasticity": -1.6},
]

CUSTOMERS = [
    {"id": "WMT", "name": "Walmart / Sam's Club", "channel": "Mass / Club", "region": "National", "tier": "Tier 1", "vol_share": 0.28},
    {"id": "KRG", "name": "Kroger", "channel": "Grocery", "region": "National", "tier": "Tier 1", "vol_share": 0.18},
    {"id": "TGT", "name": "Target", "channel": "Mass", "region": "National", "tier": "Tier 1", "vol_share": 0.12},
    {"id": "CST", "name": "Costco", "channel": "Club", "region": "National", "tier": "Tier 1", "vol_share": 0.10},
]

# Seasonality indices by category and month (1 = baseline)
SEASONALITY = {
    "Beverages":     [0.88, 0.85, 0.92, 0.98, 1.05, 1.18, 1.25, 1.20, 1.08, 1.05, 1.10, 1.16],
    "Snacks":        [0.90, 0.88, 0.92, 0.95, 1.00, 1.05, 1.08, 1.12, 1.10, 1.05, 1.15, 1.28],
    "Personal Care": [1.05, 0.95, 0.98, 1.00, 1.02, 1.00, 0.98, 0.98, 1.00, 1.00, 1.02, 1.10],
    "Household":     [1.10, 0.95, 1.05, 1.05, 1.00, 1.00, 0.95, 0.95, 1.00, 1.00, 1.05, 1.20],
    "Dairy":         [0.95, 0.92, 0.98, 1.00, 1.02, 1.05, 1.08, 1.05, 1.00, 1.02, 1.08, 1.18],
}

# Promo type lift factors (min, max)
PROMO_LIFTS = {
    "TPR":                    (0.15, 0.25),
    "Display":                (0.28, 0.42),
    "Feature":                (0.22, 0.35),
    "Display+Feature":        (0.50, 0.80),
    "Display+Feature+TPR":    (0.65, 1.00),
}

PROMO_TYPES = list(PROMO_LIFTS.keys())
PROMO_WEIGHTS = [0.30, 0.20, 0.18, 0.20, 0.12]  # frequency weights

# Promo discount levels by type
PROMO_DISCOUNTS = {
    "TPR":                    (0.10, 0.18),
    "Display":                (0.05, 0.10),
    "Feature":                (0.05, 0.10),
    "Display+Feature":        (0.12, 0.20),
    "Display+Feature+TPR":    (0.18, 0.28),
}

REGIONS = ["Northeast", "Southeast", "Midwest", "Southwest", "West", "National"]


def _get_seasonality(category: str, month: int) -> float:
    return SEASONALITY.get(category, [1.0] * 12)[month - 1]


def _get_weeks(start_year: int = 2023, num_years: int = 2) -> List[date]:
    start = date(start_year, 1, 2)
    weeks = []
    current = start
    while current.year < start_year + num_years:
        weeks.append(current)
        current += timedelta(weeks=1)
    return weeks


def _get_trend_factor(week_idx: int, total_weeks: int, category: str) -> float:
    """Annual trend: slight growth for energy/protein, flat for commoditized."""
    growth_rates = {
        "Beverages": 0.03, "Snacks": 0.02, "Personal Care": 0.01,
        "Household": -0.01, "Dairy": 0.00,
    }
    rate = growth_rates.get(category, 0.0) / 52
    return 1.0 + rate * week_idx


def _generate_promo_calendar(
    product: dict, customer: dict, weeks: List[date]
) -> Dict[date, dict]:
    """Generate promotional events for a SKU/customer combo for the year."""
    events = {}
    num_events_per_year = random.randint(10, 20)
    weeks_per_year = 52
    for year_offset in range(len(weeks) // weeks_per_year):
        year_weeks = weeks[year_offset * weeks_per_year: (year_offset + 1) * weeks_per_year]
        # Space events roughly evenly with some randomness
        event_weeks_idx = sorted(random.sample(range(len(year_weeks)), min(num_events_per_year, len(year_weeks))))
        for eidx in event_weeks_idx:
            promo_type = random.choices(PROMO_TYPES, weights=PROMO_WEIGHTS)[0]
            lift_min, lift_max = PROMO_LIFTS[promo_type]
            disc_min, disc_max = PROMO_DISCOUNTS[promo_type]
            duration = random.randint(1, 2)
            for d in range(duration):
                if eidx + d < len(year_weeks):
                    w = year_weeks[eidx + d]
                    events[w] = {
                        "promo_type": promo_type,
                        "lift": random.uniform(lift_min, lift_max),
                        "discount_pct": random.uniform(disc_min, disc_max),
                        "display": "Display" in promo_type,
                        "feature": "Feature" in promo_type,
                    }
    return events


def _annual_price_increase(base_price: float, week_date: date, base_year: int = 2023) -> float:
    """Apply 3-4% annual list price increase YoY."""
    years_elapsed = (week_date.year - base_year)
    increase = 1.0 + 0.035 * years_elapsed
    return base_price * increase


def seed_products(db: Session) -> List[dict]:
    db.query(Product).delete()
    records = []
    for p in PRODUCTS:
        gm = (p["price"] - p["cogs"]) / p["price"]
        obj = Product(
            product_id=p["id"],
            sku_name=p["name"],
            brand=p["brand"],
            category=p["category"],
            subcategory=p["subcategory"],
            pack_size=p["pack"],
            uom="CASE",
            base_price=p["price"],
            cogs=p["cogs"],
            gross_margin_pct=round(gm, 4),
            launch_date=date(2020, 1, 1),
            is_active=True,
        )
        db.add(obj)
        records.append(p)
    db.commit()
    return records


def seed_customers(db: Session) -> List[dict]:
    db.query(Customer).delete()
    records = []
    for c in CUSTOMERS:
        obj = Customer(
            customer_id=c["id"],
            customer_name=c["name"],
            channel=c["channel"],
            region=c["region"],
            tier=c["tier"],
            annual_revenue_target=round(random.uniform(5_000_000, 50_000_000), 0),
            volume_share_pct=c["vol_share"],
        )
        db.add(obj)
        records.append(c)
    db.commit()
    return records


def seed_sales(db: Session) -> None:
    db.query(SalesData).delete()
    db.commit()

    weeks = _get_weeks(2023, 2)
    batch = []
    BATCH_SIZE = 500

    for prod in PRODUCTS:
        for cust in CUSTOMERS:
            # Base weekly volume: calibrated by customer size and category velocity
            category_velocity = {
                "Beverages": 250, "Snacks": 180, "Personal Care": 120,
                "Household": 90, "Dairy": 200,
            }
            base_vol = category_velocity[prod["category"]] * cust["vol_share"] * random.uniform(0.8, 1.2)

            promo_calendar = _generate_promo_calendar(prod, cust, weeks)

            for w_idx, week_date in enumerate(weeks):
                seasonality = _get_seasonality(prod["category"], week_date.month)
                trend = _get_trend_factor(w_idx, len(weeks), prod["category"])
                noise = np.random.normal(1.0, 0.06)

                list_price = _annual_price_increase(prod["price"], week_date)

                promo = promo_calendar.get(week_date)
                if promo:
                    promo_flag = True
                    promo_type = promo["promo_type"]
                    promo_disc = promo["discount_pct"]
                    promo_lift_factor = 1.0 + promo["lift"]
                    display = promo["display"]
                    feature = promo["feature"]
                    # Price elasticity effect of discount
                    price_effect = (1 - promo_disc) ** prod["elasticity"]
                    net_price = list_price * (1 - promo_disc)
                else:
                    promo_flag = False
                    promo_type = None
                    promo_disc = 0.0
                    promo_lift_factor = 1.0
                    price_effect = 1.0
                    display = False
                    feature = False
                    net_price = list_price

                baseline_vol = base_vol * seasonality * trend * noise
                incremental_vol = baseline_vol * (promo_lift_factor - 1.0) * (price_effect - 1.0 + promo_lift_factor - 1.0 + 1.0) / (promo_lift_factor) if promo_flag else 0.0
                # Cleaner: incremental = total - baseline
                total_vol = max(0.1, baseline_vol * price_effect * promo_lift_factor * noise)
                baseline_vol = max(0.1, baseline_vol)
                incremental_vol = max(0.0, total_vol - baseline_vol) if promo_flag else 0.0

                revenue = total_vol * net_price
                cogs_total = total_vol * prod["cogs"]
                gp = revenue - cogs_total

                record = SalesData(
                    week_date=week_date,
                    year=week_date.year,
                    week_number=week_date.isocalendar()[1],
                    quarter=(week_date.month - 1) // 3 + 1,
                    month=week_date.month,
                    product_id=prod["id"],
                    customer_id=cust["id"],
                    region=cust["region"],
                    volume_cases=round(total_vol, 2),
                    list_price=round(list_price, 4),
                    net_price=round(net_price, 4),
                    revenue=round(revenue, 2),
                    cogs=round(cogs_total, 2),
                    gross_profit=round(gp, 2),
                    promo_flag=promo_flag,
                    promo_type=promo_type,
                    promo_discount_pct=round(promo_disc, 4),
                    display_flag=display,
                    feature_flag=feature,
                    baseline_volume=round(baseline_vol, 2),
                    incremental_volume=round(incremental_vol, 2),
                )
                batch.append(record)
                if len(batch) >= BATCH_SIZE:
                    db.bulk_save_objects(batch)
                    db.commit()
                    batch = []

    if batch:
        db.bulk_save_objects(batch)
        db.commit()


def seed_inventory(db: Session) -> None:
    db.query(InventoryData).delete()
    db.commit()

    weeks = _get_weeks(2023, 2)
    warehouses = ["East DC", "Central DC", "West DC", "Southeast DC"]
    batch = []

    for prod in PRODUCTS:
        # Average weekly demand: sum across customers
        avg_weekly_demand = sum(
            180 * c["vol_share"] * 0.9 for c in CUSTOMERS
        )
        safety_stock = avg_weekly_demand * 2.0
        reorder_point = avg_weekly_demand * 3.5

        for wh in warehouses:
            on_hand = avg_weekly_demand * random.uniform(3, 6)
            for week_date in weeks:
                demand = avg_weekly_demand * _get_seasonality(prod["category"], week_date.month) * random.uniform(0.85, 1.15)
                on_hand = max(0, on_hand - demand) + demand * random.uniform(0.9, 1.1)
                in_transit = demand * random.uniform(0.5, 1.5)
                on_order = demand * random.uniform(1.0, 2.0) if on_hand < reorder_point else 0.0
                woc = on_hand / max(demand, 1)
                oos = on_hand < demand * 0.3

                record = InventoryData(
                    week_date=week_date,
                    product_id=prod["id"],
                    warehouse=wh,
                    region=wh.replace(" DC", ""),
                    on_hand_cases=round(on_hand, 1),
                    in_transit_cases=round(in_transit, 1),
                    on_order_cases=round(on_order, 1),
                    weeks_of_cover=round(woc, 2),
                    oos_flag=oos,
                    safety_stock=round(safety_stock, 1),
                    reorder_point=round(reorder_point, 1),
                )
                batch.append(record)

                if len(batch) >= 500:
                    db.bulk_save_objects(batch)
                    db.commit()
                    batch = []

    if batch:
        db.bulk_save_objects(batch)
        db.commit()


def seed_market_data(db: Session) -> None:
    db.query(MarketData).delete()
    db.commit()

    weeks = _get_weeks(2023, 2)
    # Brand share setup: our brands + 2 competitors per category
    brand_landscape = {
        "Beverages": {
            "BrewMaster": 0.30, "VoltEdge": 0.25, "Competitor A": 0.28, "Competitor B": 0.17,
        },
        "Snacks": {
            "CrunchCraft": 0.32, "NutHouse": 0.22, "Competitor A": 0.28, "Competitor B": 0.18,
        },
        "Personal Care": {
            "LuxeShine": 0.30, "FreshGuard": 0.24, "Competitor A": 0.28, "Competitor B": 0.18,
        },
        "Household": {
            "TidePro": 0.34, "BrightClean": 0.22, "Competitor A": 0.26, "Competitor B": 0.18,
        },
        "Dairy": {
            "CreekFarm": 0.28, "AlpineGold": 0.26, "Competitor A": 0.26, "Competitor B": 0.20,
        },
    }

    category_market_sizes = {
        "Beverages": 15_000_000, "Snacks": 12_000_000,
        "Personal Care": 8_000_000, "Household": 10_000_000, "Dairy": 9_000_000,
    }

    batch = []
    for category, brands in brand_landscape.items():
        base_market = category_market_sizes[category]
        for brand, base_share in brands.items():
            share = base_share
            for w_idx, week_date in enumerate(weeks):
                seasonality = _get_seasonality(category, week_date.month)
                market_vol = base_market * seasonality * (1 + 0.02 * w_idx / 52) * random.uniform(0.95, 1.05)
                market_val = market_vol * random.uniform(0.85, 1.15)
                # Slight share drift
                share = max(0.02, min(0.45, share + random.gauss(0, 0.002)))
                brand_vol = market_vol * share
                brand_val = market_val * share * random.uniform(0.9, 1.1)
                avg_price = brand_val / max(brand_vol, 1)

                record = MarketData(
                    week_date=week_date,
                    category=category,
                    brand=brand,
                    channel="All Channels",
                    total_market_volume=round(market_vol, 0),
                    total_market_value=round(market_val, 0),
                    brand_volume=round(brand_vol, 0),
                    brand_value=round(brand_val, 0),
                    volume_share_pct=round(share * 100, 3),
                    value_share_pct=round(share * 100 * random.uniform(0.95, 1.05), 3),
                    avg_selling_price=round(avg_price, 4),
                )
                batch.append(record)
                if len(batch) >= 500:
                    db.bulk_save_objects(batch)
                    db.commit()
                    batch = []

    if batch:
        db.bulk_save_objects(batch)
        db.commit()


def seed_forecasts(db: Session) -> None:
    """Generate 12-week forward forecast for each SKU/customer."""
    db.query(ForecastData).delete()
    db.commit()

    last_actual_date = date(2024, 12, 30)
    forecast_start = last_actual_date + timedelta(weeks=1)

    batch = []
    for prod in PRODUCTS:
        for cust in CUSTOMERS:
            category_velocity = {
                "Beverages": 250, "Snacks": 180, "Personal Care": 120,
                "Household": 90, "Dairy": 200,
            }
            base_vol = category_velocity[prod["category"]] * cust["vol_share"] * random.uniform(0.85, 1.15)
            list_price = _annual_price_increase(prod["price"], forecast_start)

            for w in range(13):
                fcast_date = forecast_start + timedelta(weeks=w)
                seasonality = _get_seasonality(prod["category"], fcast_date.month)
                trend = _get_trend_factor(104 + w, 120, prod["category"])
                fcast_vol = base_vol * seasonality * trend * random.uniform(0.95, 1.05)
                uncertainty = 0.10 + 0.02 * w
                fcast_rev = fcast_vol * list_price

                record = ForecastData(
                    week_date=fcast_date,
                    product_id=prod["id"],
                    customer_id=cust["id"],
                    forecast_volume=round(fcast_vol, 2),
                    forecast_revenue=round(fcast_rev, 2),
                    lower_bound=round(fcast_vol * (1 - uncertainty), 2),
                    upper_bound=round(fcast_vol * (1 + uncertainty), 2),
                    model_type="statistical",
                )
                batch.append(record)
                if len(batch) >= 500:
                    db.bulk_save_objects(batch)
                    db.commit()
                    batch = []

    if batch:
        db.bulk_save_objects(batch)
        db.commit()


def run_all_seeds(db: Session) -> None:
    print("  → Seeding products...")
    seed_products(db)
    print("  → Seeding customers...")
    seed_customers(db)
    print("  → Seeding sales data (~4k rows)...")
    seed_sales(db)
    print("  → Seeding inventory data...")
    seed_inventory(db)
    print("  → Seeding market data...")
    seed_market_data(db)
    print("  → Seeding forecast data...")
    seed_forecasts(db)
    print("  ✓ All data seeded successfully.")
