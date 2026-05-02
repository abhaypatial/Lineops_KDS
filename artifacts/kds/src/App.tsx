import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import KdsDisplay    from "@/pages/index";
import DashboardPage from "@/pages/dashboard";
import OrdersPage    from "@/pages/orders";
import DevicesPage   from "@/pages/devices";
import SetupPage     from "@/pages/setup";
import LivePage      from "@/pages/live";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* KDS display — no sidebar, auto-fullscreen kiosk */}
      <Route path="/" component={KdsDisplay} />

      {/* Management pages — sidebar nav */}
      <Route path="/dashboard">
        <AppLayout><DashboardPage /></AppLayout>
      </Route>
      <Route path="/orders">
        <AppLayout><OrdersPage /></AppLayout>
      </Route>
      <Route path="/devices">
        <AppLayout><DevicesPage /></AppLayout>
      </Route>
      <Route path="/setup">
        <AppLayout><SetupPage /></AppLayout>
      </Route>

      {/* Live event monitor — useful for POS integration testing */}
      <Route path="/live">
        <AppLayout><LivePage /></AppLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
