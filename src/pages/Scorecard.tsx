import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Plus, Trash2 } from 'lucide-react';

export default function Scorecard() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemRating, setNewItemRating] = useState<'+' | '-' | '='>('=');

  useEffect(() => {
    if (!user) return;
    
    const scorecardRef = collection(db, `users/${user.uid}/scorecards`);
    const q = query(scorecardRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Sort by creation time
      data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setItems(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/scorecards`);
    });

    return unsubscribe;
  }, [user]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newItemName.trim()) return;

    try {
      const scorecardRef = collection(db, `users/${user.uid}/scorecards`);
      await addDoc(scorecardRef, {
        name: newItemName.trim(),
        rating: newItemRating,
        createdAt: new Date().toISOString()
      });
      setNewItemName('');
      setNewItemRating('=');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/scorecards`);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/scorecards`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/scorecards/${id}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">The Habits Scorecard</h1>
        <p className="mt-2 text-lg text-gray-600">
          Step 1: Awareness. List your daily behaviors and rate them.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="prose prose-indigo max-w-none text-gray-600 mb-6">
          <p>
            Before you can build new habits or break bad ones, you need to understand your current ones. 
            List your daily behaviors from the moment you wake up. Then, rate each one:
          </p>
          <ul>
            <li><strong>Positive (+)</strong>: Habits that get you closer to your identity.</li>
            <li><strong>Negative (-)</strong>: Habits that pull you away from your identity.</li>
            <li><strong>Neutral (=)</strong>: Habits that are just facts of life.</li>
          </ul>
        </div>

        <form onSubmit={handleAddItem} className="flex gap-4 items-end mb-8 bg-gray-50 p-4 rounded-lg">
          <div className="flex-1">
            <label htmlFor="itemName" className="block text-sm font-medium text-gray-700 mb-1">Behavior</label>
            <input
              type="text"
              id="itemName"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
              placeholder="e.g., Wake up, Check phone, Take shower..."
            />
          </div>
          <div>
            <label htmlFor="itemRating" className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
            <select
              id="itemRating"
              value={newItemRating}
              onChange={(e) => setNewItemRating(e.target.value as '+' | '-' | '=')}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border font-mono text-center"
            >
              <option value="+">+</option>
              <option value="-">-</option>
              <option value="=">=</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={!newItemName.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-2" /> Add
          </button>
        </form>

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
              <span className="font-medium text-gray-900">{item.name}</span>
              <div className="flex items-center gap-4">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-lg ${
                  item.rating === '+' ? 'bg-green-100 text-green-700' :
                  item.rating === '-' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {item.rating}
                </span>
                <button onClick={() => handleDeleteItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-center text-gray-500 italic py-4">Your scorecard is empty. Start by adding your first morning behavior.</p>
          )}
        </div>
      </div>
    </div>
  );
}
