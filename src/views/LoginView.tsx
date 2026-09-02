import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, 
  Lock, 
  CheckCircle2, 
  BadgeCheck, 
  Mail, 
  Key, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Building2, 
  AlertCircle, 
  Loader2,
  Share2
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  
  const [investigatorId, setInvestigatorId] = useState('ID-4412-01');
  const [orgEmail, setOrgEmail] = useState('miller@sherlock.gov');
  const [password, setPassword] = useState('sherlock2026');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedId = investigatorId.trim();
    const trimmedEmail = orgEmail.trim();
    const trimmedPassword = password.trim();

    if (!trimmedId && !trimmedEmail) {
      setErrorMsg('Please enter either your Investigator ID or Organization Email.');
      return;
    }

    if (!trimmedPassword) {
      setErrorMsg('Password is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({
        investigatorId: trimmedId,
        email: trimmedEmail,
        password: trimmedPassword,
        rememberDevice
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOrgLogin = () => {
    setInvestigatorId('ID-0000-00');
    setOrgEmail('investigator@agency.gov');
    setPassword('password123');
    setErrorMsg(null);
  };

  return (
    <div className="w-full min-h-screen flex bg-[#F7F9FF] text-[#151C24] font-sans selection:bg-blue-600/20 selection:text-blue-600 overflow-hidden">
      <div className="flex w-full min-h-screen">
        
        {/* Left Panel: Brand & Intelligence Aesthetics */}
        <div className="hidden lg:flex w-[45%] bg-[#151A21] text-white flex-col justify-between p-12 relative overflow-hidden">
          
          {/* Background Grid & Abstract Network Nodes */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.5" fill="#FFFFFF" opacity="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              <path d="M 50 150 L 250 80 L 400 300 L 150 450 Z" fill="none" stroke="#FFFFFF" strokeWidth="0.5" opacity="0.3" />
              <path d="M 250 80 L 500 120 L 400 300" fill="none" stroke="#FFFFFF" strokeWidth="0.5" opacity="0.3" />
              <circle cx="50" cy="150" r="3" fill="#FFFFFF" opacity="0.6" />
              <circle cx="250" cy="80" r="4" fill="#FFFFFF" opacity="0.8" />
              <circle cx="400" cy="300" r="3" fill="#FFFFFF" opacity="0.6" />
              <circle cx="150" cy="450" r="3" fill="#FFFFFF" opacity="0.6" />
              <circle cx="500" cy="120" r="3" fill="#FFFFFF" opacity="0.6" />
            </svg>
          </div>

          {/* Top Brand Header */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <img src="/rakshak_logo.png" alt="RAKSHAK Logo" className="w-16 h-16 object-contain filter drop-shadow-md" />
              <h1 className="font-bold text-4xl tracking-tight text-white font-mono">RAKSHAK</h1>
            </div>
            <h2 className="text-xl font-semibold text-blue-200/90">
              National Crime Intelligence Platform
            </h2>
          </div>

          {/* Core Mission Quote */}
          <div className="relative z-10 max-w-md space-y-2">
            <p className="text-2xl font-semibold text-white/90 leading-relaxed font-sans">
              Connect evidence. <br />
              Resolve identities. <br />
              Understand networks.
            </p>
          </div>

          {/* Bottom Accreditation */}
          <div className="relative z-10 flex justify-between items-end">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-sans">
                SMART INDIA HACKATHON 2026
              </span>
              <span className="text-xs font-mono text-slate-500">
                SIH26189
              </span>
            </div>
            <div className="text-slate-500">
              <Share2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Right Panel: Authentication Form */}
        <div className="w-full lg:w-[55%] bg-white flex flex-col justify-center items-center p-8 lg:p-24 relative">
          <div className="w-full max-w-[440px] space-y-8">
            
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <img src="/rakshak_logo.png" alt="RAKSHAK Logo" className="w-10 h-10 object-contain" />
              <h1 className="text-2xl font-bold font-mono tracking-tight text-slate-900">RAKSHAK</h1>
            </div>

            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">
                Secure Investigator Access
              </h2>
              <p className="text-base text-slate-600">
                Authorized investigative personnel only.
              </p>
            </div>

            {/* Security Status Badges */}
            <div className="flex flex-wrap gap-3 mb-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-200">
                <Lock className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-[10px] uppercase tracking-wider text-emerald-800 font-semibold font-mono">
                  Secure Connection
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-[10px] uppercase tracking-wider text-emerald-800 font-semibold font-mono">
                  Session Protected
                </span>
              </div>
            </div>

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-800 animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs font-medium">{errorMsg}</div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Investigator ID Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600" htmlFor="investigatorId">
                  Investigator ID
                </label>
                <div className="relative border border-slate-300 rounded-lg bg-white overflow-hidden focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/10 transition-all">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <BadgeCheck className="w-4 h-4" />
                  </div>
                  <input
                    id="investigatorId"
                    type="text"
                    value={investigatorId}
                    onChange={(e) => setInvestigatorId(e.target.value)}
                    placeholder="ID-0000-00"
                    className="block w-full pl-9 pr-3 py-2.5 font-mono text-sm text-slate-900 placeholder-slate-400 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Organization Email Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600" htmlFor="orgEmail">
                  Organization Email
                </label>
                <div className="relative border border-slate-300 rounded-lg bg-white overflow-hidden focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/10 transition-all">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="orgEmail"
                    type="email"
                    value={orgEmail}
                    onChange={(e) => setOrgEmail(e.target.value)}
                    placeholder="investigator@agency.gov"
                    className="block w-full pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600" htmlFor="password">
                  Password
                </label>
                <div className="relative border border-slate-300 rounded-lg bg-white overflow-hidden focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/10 transition-all flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-9 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none bg-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Device & Password Reset Options */}
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors font-medium">
                    Remember device
                  </span>
                </label>
                <button 
                  type="button" 
                  onClick={() => setErrorMsg('For password reset, contact your Agency Security Administrator.')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold text-xs uppercase tracking-wider hover:bg-blue-700 active:bg-blue-800 transition-colors focus:ring-2 focus:ring-blue-500/50 focus:outline-none disabled:opacity-50 shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">OR</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <button
                  type="button"
                  onClick={handleOrgLogin}
                  className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-800 py-3 px-4 rounded-lg font-semibold text-xs uppercase tracking-wider hover:bg-slate-50 hover:border-slate-400 transition-colors focus:ring-2 focus:ring-slate-300 focus:outline-none shadow-xs"
                >
                  <Building2 className="w-4 h-4 text-slate-600" />
                  <span>Use Organization Login</span>
                </button>
              </div>
            </form>

            {/* Security Warning Notice */}
            <div className="mt-8 pt-6 border-t border-slate-200 text-center">
              <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                UNAUTHORIZED ACCESS IS STRICTLY PROHIBITED AND MONITORED.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
