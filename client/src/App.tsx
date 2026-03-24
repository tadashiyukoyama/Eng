import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import CRM from "./pages/CRM";
import Finance from "./pages/Finance";
import Budgets from "./pages/Budgets";
import Agenda from "./pages/Agenda";
import DocStudio from "./pages/DocStudio";
import AIConfig from "./pages/AIConfig";
import Support from "./pages/Support";
import Jarvis from "./pages/Jarvis";
import NotFound from "./pages/NotFound";

function AppRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/crm" component={CRM} />
        <Route path="/finance" component={Finance} />
        <Route path="/budgets" component={Budgets} />
        <Route path="/agenda" component={Agenda} />
        <Route path="/doc-studio" component={DocStudio} />
        <Route path="/ai-config" component={AIConfig} />
        <Route path="/support" component={Support} />
        <Route path="/jarvis" component={Jarvis} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors theme="dark" />
          <AppRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
