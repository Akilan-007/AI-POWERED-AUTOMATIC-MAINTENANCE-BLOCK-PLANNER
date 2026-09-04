import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { BlockPlannerPage } from './pages/BlockPlannerPage';
import { MaintenanceTasksPage } from './pages/MaintenanceTasksPage';
import { RailwayMapPage } from './pages/RailwayMapPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DemoModeIndicator } from './components/DemoModeIndicator';
import { api } from './services/api';

import { DisruptionProvider } from './components/DisruptionController';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('analytics');
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [lastOptimizedTime, setLastOptimizedTime] = useState<string>('');
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    loadBadgeCounts();
  }, []);

  const loadBadgeCounts = async () => {
    try {
      const tasks = await api.getMaintenanceTasks();
      setPendingCount(tasks.filter((t) => t.status === 'Pending' || t.status === 'Overdue').length);
    } catch (err) {
      console.error('Failed to load counts', err);
    }
  };

  const handleRunOptimization = async () => {
    setIsOptimizing(true);
    try {
      await api.generateOptimizedPlan();
      const now = new Date();
      setLastOptimizedTime(
        now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
      );
      loadBadgeCounts();
      // If not already in planner, take user to planner to see the result
      if (activeTab === 'dashboard') {
        setActiveTab('planner');
      }
    } catch (err) {
      console.error('Failed to run global optimization', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <DisruptionProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[#070c18] text-slate-100">
        {/* Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingTasksCount={pendingCount}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
          {/* Navbar */}
          <Navbar
            onRunOptimization={handleRunOptimization}
            isOptimizing={isOptimizing}
            lastOptimizedTime={lastOptimizedTime}
          />

          {/* Dynamic Page Views with scroll */}
          <main className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-[#0a0f1d] to-[#070c18]">
            {activeTab === 'dashboard' && (
              <DashboardPage
                onNavigate={setActiveTab}
                onRunOptimization={handleRunOptimization}
              />
            )}
            {activeTab === 'planner' && <BlockPlannerPage />}
            {activeTab === 'tasks' && <MaintenanceTasksPage />}
            {activeTab === 'network' && <RailwayMapPage />}
            {activeTab === 'analytics' && <AnalyticsPage />}
          </main>
        </div>
        
        <DemoModeIndicator />
      </div>
    </DisruptionProvider>
  );
};

export default App;
