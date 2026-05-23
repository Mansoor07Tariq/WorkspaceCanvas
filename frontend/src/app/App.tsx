import { AuthProviderSetup } from "./providers/AuthProviderSetup";
import { AppThemeProvider } from "./providers/AppThemeProvider";
import { AppRouter } from "./router/AppRouter";
import { AuthProvider } from "@/features/auth/context/AuthContext";

export default function App() {
  return (
    <AuthProviderSetup>
      <AppThemeProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </AppThemeProvider>
    </AuthProviderSetup>
  );
}
