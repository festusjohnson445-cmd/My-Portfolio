import React, { useState } from 'react';
import { Mail, Phone, MapPin, Copy, Check, Send, Calendar, ShieldCheck, ArrowRight } from 'lucide-react';
import { useProfileSync, getRightBadgeCertifications } from '../utils/profileState';

export const ContactSection: React.FC = () => {
  const { avatar, bio, documents } = useProfileSync();
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const dynamicCertifications = getRightBadgeCertifications(bio, documents);
  const contactEmail = bio.email || 'festusjohnson028@gmail.com';

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    roleTitle: '',
    email: '',
    message: '',
  });

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(contactEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const subject = encodeURIComponent(`Technical Engineering Inquiry: ${formData.roleTitle || 'Mechanical Role'} at ${formData.company || 'Team'}`);
    const body = encodeURIComponent(`From: ${formData.name} (${formData.email})\nCompany: ${formData.company}\nRole: ${formData.roleTitle}\n\nMessage:\n${formData.message}`);
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <section id="contact" className="py-12 sm:py-18 border-t border-[#b8c6d4] bg-[#dce1e8] font-serif">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Engineer Bio & Recruiter Fast Facts */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                </span>
                <span className="text-xs sm:text-sm font-sans font-bold text-emerald-900 uppercase tracking-wider">
                  Available Q4 2026 · Immediate / 2-Week Notice
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-950 tracking-tight mt-1">
                Initiate Recruiter Contact
              </h2>
              <p className="text-base sm:text-lg text-slate-700 mt-2 leading-relaxed">
                Currently fielding technical screening conversations for Senior Mechanical Design, Robotics Hardware Architecture, and DFM Engineering Lead positions.
              </p>
            </div>

            {/* Engineer Profile Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] flex items-center gap-4 shadow-sm">
              <img
                src={avatar}
                alt={`${bio.fullName || 'Festus Johnson'} - Lead Mechanical Engineer`}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-[#b8c6d4] shrink-0"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-slate-950 truncate">{bio.fullName || 'Festus Johnson'}</h3>
                <p className="text-sm font-sans font-semibold text-cyan-900">{bio.discipline || 'Lead Mechanical Design Engineer'}</p>
                <div className="text-xs sm:text-sm text-slate-600 font-sans mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-medium text-slate-800">{dynamicCertifications}</span>
                </div>
              </div>
            </div>

            {/* Contact Details List */}
            <div className="space-y-3 text-sm font-serif">
              <div className="p-3.5 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5 text-slate-800">
                  <Mail className="w-4 h-4 text-cyan-800" />
                  <span className="truncate font-sans font-medium">{contactEmail}</span>
                </div>
                <button
                  onClick={handleCopyEmail}
                  className="px-3 py-1.5 rounded-lg bg-[#e2e8f0] hover:bg-white text-slate-900 border border-[#b8c6d4] transition-colors flex items-center gap-1.5 cursor-pointer font-sans text-xs font-semibold"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] flex items-center gap-2.5 text-slate-800 shadow-xs font-sans text-sm">
                <MapPin className="w-4 h-4 text-cyan-800 shrink-0" />
                <span>Target: SF Bay Area / Seattle / Austin / Boston / Remote</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] flex items-center gap-2.5 text-slate-800 shadow-xs font-sans text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>US Authorized · Security Clearance Eligible</span>
              </div>
            </div>
          </div>

          {/* Right Column: Direct Recruiter Inquiry Form */}
          <div className="lg:col-span-7">
            <div className="p-6 sm:p-8 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] shadow-sm">
              <div className="border-b border-[#cbd5e1] pb-4 mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-950">Direct Recruiter Fast-Track Message</h3>
                <p className="text-sm sm:text-base text-slate-700 mt-1">
                  Submissions route immediately to personal inbox with high-priority flagging.
                </p>
              </div>

              {submitted ? (
                <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-300 text-center space-y-3">
                  <Check className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h4 className="text-lg font-bold text-slate-950">Inquiry Initialized</h4>
                  <p className="text-sm sm:text-base text-slate-700 max-w-md mx-auto">
                    Your email client has been launched with the prefilled technical spec. Looking forward to our conversation.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="mt-3 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sm text-white font-sans font-semibold transition-colors cursor-pointer"
                  >
                    Send Another Note
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-800 text-sm font-sans font-semibold mb-1">Your Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Sarah Lin, Principal Recruiter"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#b8c6d4] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-700 shadow-xs text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-800 text-sm font-sans font-semibold mb-1">Company / Team *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Joby Aviation / Boston Dynamics"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#b8c6d4] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-700 shadow-xs text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-800 text-sm font-sans font-semibold mb-1">Role Title / Project *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Senior Mechanical Design Engineer"
                        value={formData.roleTitle}
                        onChange={(e) => setFormData({ ...formData, roleTitle: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#b8c6d4] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-700 shadow-xs text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-800 text-sm font-sans font-semibold mb-1">Work Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="recruiter@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#b8c6d4] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-700 shadow-xs text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-800 text-sm font-sans font-semibold mb-1">Role Scope or Technical Challenge</label>
                    <textarea
                      rows={4}
                      placeholder="Share brief notes on team charter, target timeline, compensation band, or scheduling a technical screen..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#b8c6d4] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-700 shadow-xs text-sm"
                    />
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-xs sm:text-sm text-slate-600 font-sans">
                      Standard response time: &lt; 4 business hours.
                    </span>

                    <button
                      type="submit"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-cyan-700 hover:bg-cyan-800 text-white shadow-md transition-all cursor-pointer whitespace-nowrap text-sm sm:text-base"
                    >
                      <Send className="w-4 h-4" />
                      <span>Transmit Inquiry</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
