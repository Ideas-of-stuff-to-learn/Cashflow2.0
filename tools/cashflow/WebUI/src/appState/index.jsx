import { AuthProvider } from './AuthContext';
import { ProcessingProvider } from './ProcessingContext';
import { TransactionsProvider } from './TransactionsContext';
import { ChartFilterProvider } from './ChartFilterContext';
import { UserPreferencesProvider } from './UserPreferencesContext';

export { useAuth } from './AuthContext';
export { useProcessing } from './ProcessingContext';
export { useTransactions } from './TransactionsContext';
export { useChartFilter } from './ChartFilterContext';
export { useUserPreferences } from './UserPreferencesContext';

// Nesting order matters: inner providers may consume outer ones.
//   AuthProvider (no deps)
//     UserPreferencesProvider (consumes Auth for server hydration)
//       ProcessingProvider (no deps)
//         TransactionsProvider (consumes Auth, Processing)
//           ChartFilterProvider (consumes Auth, Transactions)
export function AppStateProvider({ children }) {
    return (
        <AuthProvider>
            <UserPreferencesProvider>
                <ProcessingProvider>
                    <TransactionsProvider>
                        <ChartFilterProvider>
                            {children}
                        </ChartFilterProvider>
                    </TransactionsProvider>
                </ProcessingProvider>
            </UserPreferencesProvider>
        </AuthProvider>
    );
}
