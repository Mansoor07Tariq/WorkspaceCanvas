import { AppThemeProvider } from "./providers/AppThemeProvider";
import { AppRouter } from "./router/AppRouter";

export default function App() {
  return (
    <AppThemeProvider>
      <AppRouter />
    </AppThemeProvider>
  );
}
