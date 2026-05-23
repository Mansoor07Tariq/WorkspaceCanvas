import { AuthProviderSetup } from "./providers/AuthProviderSetup";
import { AppThemeProvider } from "./providers/AppThemeProvider";
import { AppRouter } from "./router/AppRouter";

export default function App() {
  return (
    <AuthProviderSetup>
      <AppThemeProvider>
        <AppRouter />
      </AppThemeProvider>
    </AuthProviderSetup>
  );
}
