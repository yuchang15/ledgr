import { Home, Camera, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === '/';
  const isProfile = location.pathname === '/profile';

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 safe-bottom z-50">
      <div className="flex items-center justify-around px-4 pt-2 pb-3">
        {/* Home */}
        <button
          onClick={() => navigate('/')}
          className="flex flex-col items-center gap-0.5 min-w-[60px]"
        >
          <Home
            size={22}
            className={isHome ? 'text-green-600' : 'text-gray-400 dark:text-gray-500'}
            strokeWidth={isHome ? 2.5 : 1.8}
          />
          <span className={`text-[11px] font-medium ${isHome ? 'text-green-600' : 'text-gray-400 dark:text-gray-500'}`}>
            Home
          </span>
        </button>

        {/* Camera — center with green bubble */}
        <button
          onClick={() => navigate('/capture')}
          className="flex flex-col items-center gap-0.5 -mt-5"
        >
          <div className="w-14 h-14 rounded-full bg-green-600 shadow-lg shadow-green-600/40 flex items-center justify-center">
            <Camera size={26} className="text-white" strokeWidth={2} />
          </div>
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">Capture</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => navigate('/profile')}
          className="flex flex-col items-center gap-0.5 min-w-[60px]"
        >
          <User
            size={22}
            className={isProfile ? 'text-green-600' : 'text-gray-400 dark:text-gray-500'}
            strokeWidth={isProfile ? 2.5 : 1.8}
          />
          <span className={`text-[11px] font-medium ${isProfile ? 'text-green-600' : 'text-gray-400 dark:text-gray-500'}`}>
            Profile
          </span>
        </button>
      </div>
    </nav>
  );
}
