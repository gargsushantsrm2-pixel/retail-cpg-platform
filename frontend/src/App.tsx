import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import CommandCenter        from './pages/CommandCenter'
import ExecutiveDashboard   from './pages/ExecutiveDashboard'
import RevenueGrowth        from './pages/RevenueGrowth'
import CategoryIntelligence from './pages/CategoryIntelligence'
import DemandForecasting    from './pages/DemandForecasting'
import SupplyChain          from './pages/SupplyChain'
import CommercialExcellence from './pages/CommercialExcellence'
import ScenarioPlanner      from './pages/ScenarioPlanner'
import RMMOverview          from './pages/rmm/RMMOverview'
import ThreeCScorecard      from './pages/rmm/ThreeCScorecard'
import ElasticityLab        from './pages/rmm/ElasticityLab'
import PromoOptimizer       from './pages/rmm/PromoOptimizer'
import TradeTerms           from './pages/rmm/TradeTerms'
import MarginGovernance     from './pages/rmm/MarginGovernance'
import ConsumerScience      from './pages/rmm/ConsumerScience'
import PriceArchitecture    from './pages/rmm/PriceArchitecture'
import DemandPlanning       from './pages/rmm/DemandPlanning'
import InvestmentDeals      from './pages/rmm/InvestmentDeals'
import PlatformGovernance   from './pages/rmm/PlatformGovernance'
import Methodology          from './pages/Methodology'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index               element={<CommandCenter />} />
          <Route path="executive"    element={<ExecutiveDashboard />} />
          <Route path="rgm"          element={<RevenueGrowth />} />
          <Route path="category"     element={<CategoryIntelligence />} />
          <Route path="forecasting"  element={<DemandForecasting />} />
          <Route path="supply"       element={<SupplyChain />} />
          <Route path="commercial"   element={<CommercialExcellence />} />
          <Route path="scenario"     element={<ScenarioPlanner />} />
          <Route path="rmm"          element={<RMMOverview />} />
          <Route path="rmm/three-c"  element={<ThreeCScorecard />} />
          <Route path="rmm/elasticity" element={<ElasticityLab />} />
          <Route path="rmm/promo"    element={<PromoOptimizer />} />
          <Route path="rmm/trade-terms" element={<TradeTerms />} />
          <Route path="rmm/governance" element={<MarginGovernance />} />
          <Route path="rmm/consumer"   element={<ConsumerScience />} />
          <Route path="rmm/price-arch" element={<PriceArchitecture />} />
          <Route path="rmm/demand"     element={<DemandPlanning />} />
          <Route path="rmm/investment" element={<InvestmentDeals />} />
          <Route path="rmm/platform"   element={<PlatformGovernance />} />
          <Route path="methodology"    element={<Methodology />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
