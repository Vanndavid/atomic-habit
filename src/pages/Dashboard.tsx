import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Target, Activity, ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

export default function Dashboard() {
  const { user } = useAuth();
  const [identityStatement, setIdentityStatement] = useState<string>('');
  const [habits, setHabits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setIdentityStatement(docSnap.data().identityStatement || '');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    const habitsRef = collection(db, `users/${user.uid}/habits`);
    const q = query(habitsRef);
    const unsubscribeHabits = onSnapshot(q, (snapshot) => {
      const habitsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHabits(habitsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/habits`);
    });

    return () => {
      unsubscribeUser();
      unsubscribeHabits();
    };
  }, [user]);

  if (loading) {
    return <div className="animate-pulse flex flex-col space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/4"></div>
      <div className="h-32 bg-gray-200 rounded"></div>
      <div className="h-64 bg-gray-200 rounded"></div>
    </div>;
  }

  const goodHabits = habits.filter(h => h.type === 'good');
  const badHabits = habits.filter(h => h.type === 'bad');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.displayName?.split(' ')[0] || 'Builder'}</h1>
        <p className="mt-1 text-sm text-gray-500">
          "You do not rise to the level of your goals. You fall to the level of your systems."
        </p>
      </div>

      {/* Identity Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mr-4">
              <Target className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Your Identity</h2>
          </div>
          {identityStatement ? (
            <blockquote className="text-xl font-medium text-gray-900 italic border-l-4 border-indigo-500 pl-4 py-2">
              "{identityStatement}"
            </blockquote>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p className="text-gray-500 mb-4">You haven't defined your identity statement yet.</p>
              <Link to="/identity" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                Define Identity
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Habits Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
              Building ({goodHabits.length})
            </h3>
            <Link to="/law1" className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center">
              Manage <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          {goodHabits.length > 0 ? (
            <ul className="space-y-3">
              {goodHabits.slice(0, 5).map(habit => (
                <li key={habit.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-900">{habit.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 italic">No good habits tracked yet.</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
              Breaking ({badHabits.length})
            </h3>
            <Link to="/law1" className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center">
              Manage <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          {badHabits.length > 0 ? (
            <ul className="space-y-3">
              {badHabits.slice(0, 5).map(habit => (
                <li key={habit.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-900">{habit.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 italic">No bad habits tracked yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
