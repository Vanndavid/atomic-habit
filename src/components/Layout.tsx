import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { signOut, db } from '../firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  LogOut,
  Target,
  Rocket
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Job Tracker', href: '/job-tracker', icon: Target },
];

export default function Layout() {
  const { user } = useAuth();
  const [hasUncompletedTasks, setHasUncompletedTasks] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const tasksRef = collection(db, `users/${user.uid}/atomicTasks`);
    const q = query(tasksRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      let uncompleted = false;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (!data.archived && !(data.completions || []).includes(todayStr)) {
          uncompleted = true;
          break;
        }
      }
      setHasUncompletedTasks(uncompleted);
    });

    return unsubscribe;
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <Rocket className="w-6 h-6 text-indigo-600 mr-2" />
          <span className="font-bold text-gray-900 text-lg">WorkFlow</span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="px-3 space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    isActive
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors relative'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn(
                        isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500',
                        'flex-shrink-0 -ml-1 mr-3 h-5 w-5 transition-colors'
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.name}</span>
                    {item.name === 'Dashboard' && hasUncompletedTasks && (
                      <span className="absolute right-3 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
        
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <div className="ml-3 truncate">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.displayName || 'User'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5 text-gray-400" />
            Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden bg-white border-b border-gray-200 h-16 flex items-center px-4 justify-between">
          <div className="flex items-center">
            <Rocket className="w-6 h-6 text-indigo-600 mr-2" />
            <span className="font-bold text-gray-900">WorkFlow</span>
          </div>
          <button onClick={signOut} className="text-gray-500 hover:text-gray-700">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        
        <main className="flex-1 overflow-y-auto focus:outline-none">
          <div className="py-6 px-4 sm:px-6 md:px-8 max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
