import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { GoogleGenAI } from '@google/genai';
import { Briefcase, MessageSquare, Loader2, Target, Building, MapPin, Trash2, Send, Filter, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const STATUSES = ['Bookmarked', 'Applied', 'Interviewing', 'Offer', 'Rejected'];
const ITEMS_PER_PAGE = 10;

export default function JobTracker() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filter and sort state
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState('date-desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, sortBy]);

  useEffect(() => {
    if (!user) return;
    
    const jobsRef = collection(db, `users/${user.uid}/jobs`);
    const q = query(jobsRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setJobs(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/jobs`);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const filteredAndSortedJobs = useMemo(() => {
    let result = [...jobs];
    
    // Filter
    if (filterStatus !== 'All') {
      result = result.filter(job => job.status === filterStatus);
    }
    
    // Sort
    result.sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'date-asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'company-asc') {
        return (a.company || '').localeCompare(b.company || '');
      }
      if (sortBy === 'company-desc') {
        return (b.company || '').localeCompare(a.company || '');
      }
      if (sortBy === 'status') {
        return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
      }
      return 0;
    });
    
    return result;
  }, [jobs, filterStatus, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedJobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = filteredAndSortedJobs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !chatInput.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const prompt = `Extract the job application details from the following user input: "${chatInput}".
Return ONLY a valid JSON object with this exact structure:
{
  "company": "Company Name",
  "role": "Job Title/Role",
  "location": "Location (e.g., Melbourne, Remote) or empty string",
  "status": "Must be exactly one of: 'Bookmarked', 'Applied', 'Interviewing', 'Offer', 'Rejected' (if they say they applied or sent resume, use 'Applied'. Default to 'Bookmarked')",
  "notes": "Any other context or notes mentioned (or empty)"
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
      
      const parsedData = JSON.parse(text);
      
      const jobsRef = collection(db, `users/${user.uid}/jobs`);
      await addDoc(jobsRef, {
        company: parsedData.company || 'Unknown',
        role: parsedData.role || 'Unknown Role',
        location: parsedData.location || '',
        status: parsedData.status || 'Applied',
        notes: parsedData.notes || '',
        createdAt: new Date().toISOString()
      });

      setChatInput('');
    } catch (error) {
      console.error("Error processing job:", error);
      alert("Ah, I couldn't understand that. Make sure to mention the company and role!");
    } finally {
      setIsProcessing(false);
    }
  };

  const updateStatus = async (jobId: string, newStatus: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, `users/${user.uid}/jobs`, jobId), {
        status: newStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/jobs/${jobId}`);
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to delete this job application?')) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/jobs`, jobId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/jobs/${jobId}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Bookmarked': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Applied': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Interviewing': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Offer': return 'bg-green-100 text-green-800 border-green-200';
      case 'Rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Target className="w-8 h-8 mr-3 text-indigo-600" />
          Job Tracker
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          Track your applications in one place. Just tell AI what you applied for.
        </p>
      </div>

      {/* AI Chat Input */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-100 shadow-sm">
        <label htmlFor="chatInput" className="block text-sm font-semibold text-indigo-900 mb-2 flex items-center">
          <MessageSquare className="w-4 h-4 mr-2" />
          Log a new job application
        </label>
        <form onSubmit={handleChatSubmit} className="flex gap-4">
          <input
            type="text"
            id="chatInput"
            disabled={isProcessing}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="e.g., 'Applied for Senior React Dev at Canva in Melbourne today. Waiting to hear back.'"
            className="flex-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-lg p-3 bg-white"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || isProcessing}
            className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Add Job
              </>
            )}
          </button>
        </form>
      </div>

      {/* Filters & Sorting */}
      {jobs.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-auto p-2 border"
            >
              <option value="All">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <ArrowUpDown className="w-4 h-4 text-gray-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-auto p-2 border"
            >
              <option value="date-desc">Date Added (Newest)</option>
              <option value="date-asc">Date Added (Oldest)</option>
              <option value="company-asc">Company (A to Z)</option>
              <option value="company-desc">Company (Z to A)</option>
              <option value="status">Status Priority</option>
            </select>
          </div>
        </div>
      )}

      {/* Jobs List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-900">No jobs tracked yet</p>
            <p className="mt-1">Use the chat box above to log your first application!</p>
          </div>
        ) : filteredAndSortedJobs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Filter className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-900">No jobs match this filter</p>
            <button 
              onClick={() => setFilterStatus('All')}
              className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role & Company</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Added</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">{job.role}</span>
                        <div className="flex items-center text-sm text-gray-500 mt-1 space-x-3">
                          <span className="flex items-center"><Building className="w-4 h-4 mr-1 text-gray-400"/> {job.company}</span>
                          {job.location && <span className="flex items-center"><MapPin className="w-4 h-4 mr-1 text-gray-400"/> {job.location}</span>}
                        </div>
                        {job.notes && <p className="text-sm text-gray-500 italic mt-2 border-l-2 border-gray-200 pl-2">{job.notes}</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={job.status}
                        onChange={(e) => updateStatus(job.id, e.target.value)}
                        className={`text-xs font-bold rounded-full px-3 py-1 border focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 cursor-pointer ${getStatusColor(job.status)}`}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(job.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => deleteJob(job.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && jobs.length > 0 && filteredAndSortedJobs.length > 0 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6 flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedJobs.length)}</span> of <span className="font-medium">{filteredAndSortedJobs.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
