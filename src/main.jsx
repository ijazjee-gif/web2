import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import AppLayout from './components/AppLayout.jsx';
import StaticPage from './pages/StaticPage.jsx';
import COTPage from './pages/COTPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ProtectedPage from './pages/ProtectedPage.jsx';
import NotFound from './pages/NotFound.jsx';
import { staticPages, toolPages } from './pages/staticPages.js';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<StaticPage html={staticPages.home} pageKey="home" />} />
          <Route path="dashboard" element={<ProtectedPage><StaticPage html={staticPages.dashboard} pageKey="dashboard" /></ProtectedPage>} />
          <Route path="live" element={<StaticPage html={staticPages.live} pageKey="live" />} />
          <Route path="tools" element={<StaticPage html={staticPages.tools} pageKey="tools" />} />
          {Object.entries(toolPages).map(([slug, html]) => (
            <Route key={slug} path={`tools/${slug}`} element={<StaticPage html={html} pageKey={`tool-${slug}`} />} />
          ))}
          <Route path="cot" element={<COTPage />} />
          <Route path="education" element={<StaticPage html={staticPages.education} pageKey="education" />} />
          <Route path="blog" element={<StaticPage html={staticPages.blog} pageKey="blog" />} />
          <Route path="about" element={<StaticPage html={staticPages.about} pageKey="about" />} />
          <Route path="contact" element={<StaticPage html={staticPages.contact} pageKey="contact" />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="logout" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
