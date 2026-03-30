import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// SOFORT beim Laden, BEVOR React Router irgendetwas tut
const initialUrlParams = new URLSearchParams(window.location.search);
const initialDealId = initialUrlParams.get('deal_id') || initialUrlParams.get('dealId') || initialUrlParams.get('entityId');
if (initialDealId) {
  sessionStorage.setItem('zoho_deal_id', initialDealId);
}

createRoot(document.getElementById("root")!).render(<App />);
