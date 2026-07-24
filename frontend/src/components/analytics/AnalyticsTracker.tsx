import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { analytics } from "../../services/analytics";

export function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    analytics.trackScreen(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}
