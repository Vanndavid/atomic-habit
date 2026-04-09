import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { GoogleGenAI } from '@google/genai';
import { format } from 'date-fns';
import { Briefcase, CheckCircle2, Loader2, Sparkles, Save } from 'lucide-react';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function JobHuntPlanner() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [reflectionAnswer, setReflectionAnswer] = useState('');
  const [notes, setNotes] = useState('');
  const [completed, setCompleted] = useState(false);

  const [plans, setPlans] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [streak, setStreak] = useState(0);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayPlan = plans.find(p => p.date === todayStr);
  const pastPlans = plans.filter(p => p.date !== todayStr);

  useEffect(() => {
    if (!user) return;

    const fetchPlans = async () => {
      try {
        const plansRef = collection(db, `users/${user.uid}/dailyPlans`);
        const q = query(plansRef, orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        
        const fetchedPlans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setPlans(fetchedPlans);
        
        const today = fetchedPlans.find(p => p.date === todayStr);
        if (today) {
          setReflectionAnswer(today.reflectionAnswer || '');
          setNotes(today.notes || '');
          setCompleted(today.completed || false);
        }

        // Calculate streak
        let currentStreak = 0;
        let checkDate = new Date();
        let checkDateStr = format(checkDate, 'yyyy-MM-dd');
        
        const planMap = fetchedPlans.reduce((acc, p) => {
          acc[p.date] = p;
          return acc;
        }, {} as Record<string, any>);

        if (!planMap[checkDateStr]?.completed) {
          // If today isn't completed, check yesterday
          checkDate.setDate(checkDate.getDate() - 1);
          checkDateStr = format(checkDate, 'yyyy-MM-dd');
        }

        while (planMap[checkDateStr]?.completed) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
          checkDateStr = format(checkDate, 'yyyy-MM-dd');
        }
        setStreak(currentStreak);

      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/dailyPlans`);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [user, todayStr]);

  const generatePlan = async () => {
    if (!user) return;
    setGenerating(true);

    try {
      let contextPrompt = "";
      if (pastPlans.length > 0) {
        const lastPlan = pastPlans[0];
        contextPrompt = `
Context from yesterday's plan:
- Focus: ${lastPlan.focus}
- Notes: ${lastPlan.notes || 'None'}
- Reflection Answer: ${lastPlan.reflectionAnswer || 'None'}
Use this context to build a progressive plan for today. If they struggled with something, reinforce it. If they finished something, move to the next step.`;
      }

      const prompt = `My profile:
- Software Engineer with 3 years of experience.
- Recent Master's degree graduate.
- Currently in Australia on a 485 temporary resident visa (expires Feb 2028).
- Job hunting for 4 months without success.
- Goal: Get a full-time software engineering job with a good salary in Victoria, Australia within the next 4-8 weeks to secure a PR invite.

Generate a simple, structured daily plan for today.${contextPrompt}
Rules:
- Keep everything simple and actionable
- Tailor the job application task to the Australian/Victorian market, PR requirements, and mid-level roles
- No long explanations
- No motivation or emotional language
- Tasks must be completable within a few hours total
- Focus on consistency, not intensity

Return ONLY a valid JSON object with this exact structure:
{
  "focus": "Daily Focus (1 sentence only)",
  "tasks": ["Must-Do Task 1", "Must-Do Task 2", "Must-Do Task 3"],
  "skillTask": "1 Skill Improvement Task (based on weaknesses: testing, communication, system design)",
  "jobTask": "1 Job Application Task (specific and actionable)",
  "reflectionPrompt": "1 Reflection Question (short)"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      const generatedData = JSON.parse(text);
      
      // Save to Firestore
      const newDocRef = doc(collection(db, `users/${user.uid}/dailyPlans`));
      const newPlan = {
        date: todayStr,
        focus: generatedData.focus,
        tasks: generatedData.tasks,
        skillTask: generatedData.skillTask,
        jobTask: generatedData.jobTask,
        reflectionPrompt: generatedData.reflectionPrompt,
        reflectionAnswer: '',
        completed: false,
        notes: '',
        createdAt: new Date().toISOString()
      };
      
      await setDoc(newDocRef, newPlan);
      
      setPlans([{ id: newDocRef.id, ...newPlan }, ...plans]);
      setReflectionAnswer('');
      setNotes('');
      setCompleted(false);
      
    } catch (error) {
      console.error("Error generating plan:", error);
      alert("Failed to generate plan. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const saveProgress = async (isCompleted: boolean = completed) => {
    if (!user || !todayPlan) return;
    setSaving(true);
    
    try {
      const planRef = doc(db, `users/${user.uid}/dailyPlans`, todayPlan.id);
      await updateDoc(planRef, {
        reflectionAnswer,
        notes,
        completed: isCompleted
      });
      setCompleted(isCompleted);
      
      // Update local state
      setPlans(plans.map(p => p.id === todayPlan.id ? { ...p, reflectionAnswer, notes, completed: isCompleted } : p));
      
      // Update streak if newly completed
      if (isCompleted && !todayPlan.completed) {
        setStreak(streak + 1);
      } else if (!isCompleted && todayPlan.completed) {
        setStreak(Math.max(0, streak - 1));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/dailyPlans/${todayPlan.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Briefcase className="w-8 h-8 mr-3 text-indigo-600" />
            Job Hunt Planner
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Your structured, AI-generated daily plan to land a software engineering role in 4-8 weeks.
          </p>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 text-center">
          <div className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Current Streak</div>
          <div className="text-2xl font-black text-indigo-600">{streak} <span className="text-sm font-medium">days</span></div>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('today')}
            className={`${
              activeTab === 'today'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Today's Plan
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`${
              activeTab === 'history'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            History ({pastPlans.length})
          </button>
        </nav>
      </div>

      {activeTab === 'today' && (
        !todayPlan ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No plan for today yet</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Generate a simple, actionable plan focused on consistency, skill improvement, and job applications.
            </p>
            <button
              onClick={generatePlan}
              disabled={generating}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
            >
              {generating ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" /> Generate Today's Plan</>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">Today's Plan ({format(new Date(), 'MMM d, yyyy')})</h2>
                {completed && <span className="bg-green-400 text-green-900 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wide">Completed</span>}
              </div>
              
              <div className="p-6 space-y-8">
                {/* Focus */}
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Daily Focus</h3>
                  <p className="text-lg font-medium text-gray-900 border-l-4 border-indigo-500 pl-4 py-1">
                    {todayPlan.focus}
                  </p>
                </div>

                {/* Tasks */}
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">3 Must-Do Tasks</h3>
                  <ul className="space-y-3">
                    {todayPlan.tasks.map((task: string, i: number) => (
                      <li key={i} className="flex items-start">
                        <div className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-full border-2 border-gray-300 text-gray-500 font-medium text-xs mt-0.5 mr-3">
                          {i + 1}
                        </div>
                        <span className="text-gray-800">{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Skill Task */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Skill Improvement</h3>
                    <p className="text-blue-900 text-sm">{todayPlan.skillTask}</p>
                  </div>

                  {/* Job Task */}
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <h3 className="text-xs font-bold text-green-800 uppercase tracking-wider mb-2">Job Application</h3>
                    <p className="text-green-900 text-sm">{todayPlan.jobTask}</p>
                  </div>
                </div>

                {/* Reflection */}
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Reflection</h3>
                  <p className="text-gray-800 font-medium mb-3">{todayPlan.reflectionPrompt}</p>
                  <textarea
                    value={reflectionAnswer}
                    onChange={(e) => setReflectionAnswer(e.target.value)}
                    placeholder="Your short reflection..."
                    rows={2}
                    className="w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md p-3 border"
                  />
                </div>

                {/* Tracking */}
                <div className="border-t border-gray-100 pt-6 bg-gray-50 -mx-6 -mb-6 p-6">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Daily Log</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes (1-2 lines max)</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Brief notes on today's progress..."
                        className="w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md p-2 border"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={completed}
                          onChange={(e) => setCompleted(e.target.checked)}
                          className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-900">Mark day as completed</span>
                      </label>
                      
                      <button
                        onClick={() => saveProgress(completed)}
                        disabled={saving}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        {saving ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                        ) : (
                          <><Save className="w-4 h-4 mr-2" /> Save Log</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          {pastPlans.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No past plans found. Your history will appear here tomorrow.</p>
          ) : (
            pastPlans.map((p) => (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 flex justify-between items-center border-b border-gray-200">
                  <h3 className="font-medium text-gray-900">{format(new Date(p.date), 'EEEE, MMM d, yyyy')}</h3>
                  {p.completed ? (
                    <span className="flex items-center text-green-600 text-sm font-medium"><CheckCircle2 className="w-4 h-4 mr-1"/> Completed</span>
                  ) : (
                    <span className="text-gray-400 text-sm font-medium">Incomplete</span>
                  )}
                </div>
                <div className="p-6">
                  <p className="text-gray-900 font-medium mb-4">Focus: {p.focus}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tasks</h4>
                      <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                        {p.tasks.map((t: string, i: number) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
                      <p className="text-sm text-gray-600 italic">{p.notes || 'No notes recorded.'}</p>
                    </div>
                  </div>
                  
                  <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                    <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">Reflection</h4>
                    <p className="text-sm text-indigo-900 font-medium mb-1">{p.reflectionPrompt}</p>
                    <p className="text-sm text-indigo-700">{p.reflectionAnswer || 'No answer provided.'}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
