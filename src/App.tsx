/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Identity from './pages/Identity';
import Law1 from './pages/Law1';
import Law2 from './pages/Law2';
import Law3 from './pages/Law3';
import Law4 from './pages/Law4';
import Tracker from './pages/Tracker';
import JobHuntPlanner from './pages/JobHuntPlanner';
import Scorecard from './pages/Scorecard';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="identity" element={<Identity />} />
              <Route path="law1" element={<Law1 />} />
              <Route path="law2" element={<Law2 />} />
              <Route path="law3" element={<Law3 />} />
              <Route path="law4" element={<Law4 />} />
              <Route path="tracker" element={<Tracker />} />
              <Route path="job-hunt" element={<JobHuntPlanner />} />
              <Route path="scorecard" element={<Scorecard />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
