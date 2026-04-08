import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Save, CheckCircle2 } from 'lucide-react';

export default function Identity() {
  const { user } = useAuth();
  const [identityStatement, setIdentityStatement] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const fetchIdentity = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists() && docSnap.data().identityStatement) {
          setIdentityStatement(docSnap.data().identityStatement);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    };
    
    fetchIdentity();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        identityStatement
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">The Fundamentals</h1>
        <p className="mt-2 text-lg text-gray-600">
          True behavior change is identity change.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 md:p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Identity-Based Habits</h2>
          <div className="prose prose-indigo max-w-none text-gray-600 mb-8">
            <p>
              The ultimate form of intrinsic motivation is when a habit becomes part of your identity. 
              It's one thing to say I'm the type of person who <em>wants</em> this. It's something very 
              different to say I'm the type of person who <em>is</em> this.
            </p>
            <p>
              <strong>Two-Step Process to Changing Your Identity:</strong>
            </p>
            <ol>
              <li>Decide the type of person you want to be.</li>
              <li>Prove it to yourself with small wins.</li>
            </ol>
          </div>

          <div className="space-y-4">
            <label htmlFor="identity" className="block text-sm font-medium text-gray-700">
              Who is the type of person you want to become?
            </label>
            <div className="mt-1">
              <textarea
                id="identity"
                rows={4}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-3 border"
                placeholder="e.g., I am the type of person who never misses a workout. I am a writer. I am a healthy eater."
                value={identityStatement}
                onChange={(e) => setIdentityStatement(e.target.value)}
              />
            </div>
            <div className="flex justify-end items-center">
              {saved && (
                <span className="text-green-600 flex items-center mr-4 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Saved
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Identity'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
