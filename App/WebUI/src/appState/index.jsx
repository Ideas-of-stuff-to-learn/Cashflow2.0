import { AuthProvider } from './AuthContext';
import { ProcessingProvider } from './ProcessingContext';
import { TransactionsProvider } from './TransactionsContext';
import { ChartFilterProvider } from './ChartFilterContext';

export { useAuth } from './AuthContext';
export { useProcessing } from './ProcessingContext';
export { useTransactions } from './TransactionsContext';
export { useChartFilter } from './ChartFilterContext';

// Nesting order matters: inner providers may consume outer ones.
//   AuthProvider (no deps)
//     ProcessingProvider (no deps)
//       TransactionsProvider (consumes Auth, Processing)
//         ChartFilterProvider (consumes Auth, Transactions)
export function AppStateProvider({ children }) {
    return (
        <AuthProvider>
            <ProcessingProvider>
                <TransactionsProvider>
                    <ChartFilterProvider>
                        {children}
                    </ChartFilterProvider>
                </TransactionsProvider>
            </ProcessingProvider>
        </AuthProvider>
    );
}
