import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
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
  Share2,
  Activity,
  ShieldCheck,
  Network,
  Cpu
} from 'lucide-react';
import { RakshakIntelligenceAnimation } from '../components/RakshakIntelligenceAnimation';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  
  const [investigatorId, setInvestigatorId] = useState('ID-4412-01');
  const [orgEmail, setOrgEmail] = useState('miller@agency.gov');
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
    <div className="w-full min-h-screen flex bg-[#F8F7F3] text-[#17191F] font-sans selection:bg-[#283593]/20 selection:text-[#283593] overflow-x-hidden">
      <div className="flex flex-col lg:flex-row w-full min-h-screen">
        
        {/* Left Panel: RAKSHAK Branding & Three.js 3D Intelligence Matrix */}
        <div className="w-full lg:w-[50%] bg-[#151A21] text-white flex flex-col justify-between p-6 sm:p-8 lg:p-12 relative overflow-hidden shrink-0 border-b lg:border-b-0 lg:border-r border-[#2A3139]">
          
          {/* Background Grid & Abstract Lines */}
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

          {/* Top RAKSHAK Brand Header */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <img src="/rakshak_logo.png" alt="RAKSHAK Logo" className="w-12 h-12 sm:w-14 sm:h-14 object-contain filter drop-shadow-md" />
              <div>
                <h1 className="font-bold text-3xl sm:text-4xl tracking-tight text-white font-mono">RAKSHAK</h1>
                <span className="text-[10px] font-mono text-[#3B82F6] tracking-widest uppercase bg-[#2563EB]/10 px-2 py-0.5 rounded border border-[#2563EB]/30 inline-block mt-0.5">
                  INTELLIGENCE MATRIX
                </span>
              </div>
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-[#EAE0C8]">
              National Crime Intelligence Platform
            </h2>
            <p className="text-xs text-[#94A3B8] mt-1 font-sans">
              Connect evidence. Resolve identities. Reconstruct networks.
            </p>
          </div>

          {/* Center: Direct 3D Three.js Intelligence Matrix Animation Container */}
          <div className="relative z-10 my-6 lg:my-8 w-full max-w-lg mx-auto">
            <div className="relative rounded-xl overflow-hidden border border-[#2A3139] bg-[#0E1318]/90 backdrop-blur-md shadow-2xl group transition-all duration-300">
              
              {/* Radar scanline animation */}
              <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden opacity-30 group-hover:opacity-50 transition-opacity">
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-[#3B82F6] to-transparent animate-pulse" />
              </div>



              {/* Actual Three.js Animation Canvas Rendered Directly */}
              <div className="relative z-10 w-full min-h-[260px] sm:min-h-[300px]">
                <RakshakIntelligenceAnimation />
              </div>

              {/* True Non-Numeric System Status Footer */}
              <div className="relative z-10 p-3 sm:p-4 pt-0">
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-white/90">
                  <div className="flex items-center gap-1.5 bg-[#0E1318]/90 border border-[#2A3139] px-2.5 py-1.5 rounded">
                    <Cpu className="w-3 h-3 text-[#3B82F6] shrink-0" />
                    <span className="truncate text-[#94A3B8] uppercase">ENTITY RESOLUTION ACTIVE</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#0E1318]/90 border border-[#2A3139] px-2.5 py-1.5 rounded">
                    <Network className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="truncate text-emerald-400 font-medium uppercase">INVESTIGATION GRAPH READY</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Accreditation Footer */}
          <div className="relative z-10 flex justify-between items-end pt-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B8BEC7] font-sans">
                SMART INDIA HACKATHON 2026
              </span>
              <span className="text-[10px] font-mono text-[#94A3B8]">
                PROBLEM STATEMENT ID: SIH26189
              </span>
            </div>
            <div className="text-[#B8BEC7]">
              <Share2 className="w-4 h-4" />
            </div>
          </div>

        </div>

        {/* Right Panel: Authentication Form */}
        <div className="w-full lg:w-[50%] bg-[#FFFFFF] flex flex-col justify-center items-center p-6 sm:p-10 lg:p-16 relative">
          <div className="w-full max-w-[440px] space-y-6">
            
            {/* Mobile RAKSHAK Header */}
            <div className="lg:hidden flex items-center gap-3 mb-4">
              <img src="/rakshak_logo.png" alt="RAKSHAK Logo" className="w-10 h-10 object-contain" />
              <div>
                <h1 className="text-2xl font-bold font-mono tracking-tight text-[#17191F]">RAKSHAK</h1>
                <p className="text-[10px] font-mono text-[#283593]">National Crime Intelligence Platform</p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#17191F] mb-1.5 tracking-tight">
                Secure Investigator Access
              </h2>
              <p className="text-sm text-[#667085]">
                Authorized law enforcement and investigative personnel only.
              </p>
            </div>

            {/* Security Status Badges */}
            <div className="flex flex-wrap gap-2.5 mb-1">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-[#F8F7F3] rounded-full border border-[#E4E5E7]">
                <Lock className="w-3.5 h-3.5 text-[#283593]" />
                <span className="text-[10px] uppercase tracking-wider text-[#283593] font-semibold font-mono">
                  Secure Connection
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-[#F8F7F3] rounded-full border border-[#E4E5E7]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#283593]" />
                <span className="text-[10px] uppercase tracking-wider text-[#283593] font-semibold font-mono">
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
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Investigator ID Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085]" htmlFor="investigatorId">
                  Investigator ID
                </label>
                <div className="relative border border-[#E4E5E7] rounded-lg bg-[#FFFFFF] overflow-hidden focus-within:border-[#283593] focus-within:ring-2 focus-within:ring-[#283593]/10 transition-all">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#667085]">
                    <BadgeCheck className="w-4 h-4" />
                  </div>
                  <input
                    id="investigatorId"
                    type="text"
                    value={investigatorId}
                    onChange={(e) => setInvestigatorId(e.target.value)}
                    placeholder="ID-0000-00"
                    className="block w-full pl-9 pr-3 py-2.5 font-mono text-sm text-[#17191F] placeholder-[#667085]/60 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Organization Email Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085]" htmlFor="orgEmail">
                  Organization Email
                </label>
                <div className="relative border border-[#E4E5E7] rounded-lg bg-[#FFFFFF] overflow-hidden focus-within:border-[#283593] focus-within:ring-2 focus-within:ring-[#283593]/10 transition-all">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#667085]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="orgEmail"
                    type="email"
                    value={orgEmail}
                    onChange={(e) => setOrgEmail(e.target.value)}
                    placeholder="investigator@agency.gov"
                    className="block w-full pl-9 pr-3 py-2.5 text-sm text-[#17191F] placeholder-[#667085]/60 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085]" htmlFor="password">
                  Password
                </label>
                <div className="relative border border-[#E4E5E7] rounded-lg bg-[#FFFFFF] overflow-hidden focus-within:border-[#283593] focus-within:ring-2 focus-within:ring-[#283593]/10 transition-all flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#667085]">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-9 pr-10 py-2.5 text-sm text-[#17191F] placeholder-[#667085]/60 focus:outline-none bg-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#667085] hover:text-[#17191F] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Device & Password Reset Options */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="w-4 h-4 text-[#283593] border-[#E4E5E7] rounded focus:ring-[#283593]"
                  />
                  <span className="text-xs text-[#667085] group-hover:text-[#17191F] transition-colors font-medium">
                    Remember device
                  </span>
                </label>
                <button 
                  type="button" 
                  onClick={() => setErrorMsg('For password reset, contact your Agency Security Administrator.')}
                  className="text-xs text-[#283593] hover:text-[#202833] font-semibold transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-[#202833] text-[#FFFFFF] py-3 px-4 rounded-lg font-semibold text-xs uppercase tracking-wider hover:bg-[#303945] active:bg-[#303945] transition-colors focus:ring-2 focus:ring-[#283593]/50 focus:outline-none disabled:opacity-50 shadow-sm"
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


              </div>
            </form>

            {/* Security Warning Notice */}
            <div className="mt-6 pt-4 border-t border-[#E4E5E7] text-center">
              <p className="font-mono text-[10px] text-[#667085] uppercase tracking-wider">
                UNAUTHORIZED ACCESS IS STRICTLY PROHIBITED AND MONITORED.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};



