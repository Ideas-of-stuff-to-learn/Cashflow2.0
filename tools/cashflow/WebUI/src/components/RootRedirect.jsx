// components/RootRedirect.jsx
import { Navigate } from 'react-router-dom';
import { useIsMobile } from '../customHooks/useIsMobile';

// Sends the person to the right landing screen based on viewport width -
// used both for the bare "/" path and as the post-login/signup
// destination. Single place deciding "dashboard vs app-style screens",
// so nothing else needs to duplicate this logic.
export default function RootRedirect() {
    const isMobile = useIsMobile();
    return <Navigate to={isMobile ? '/home' : '/dashboard'} replace />;
}