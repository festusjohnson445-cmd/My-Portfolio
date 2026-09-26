import React from 'react';
import { Award, ShieldCheck, ExternalLink, CheckCircle2 } from 'lucide-react';
import { CERTIFICATIONS } from '../data/toolboxData';
import { useProfileSync } from '../utils/profileState';

export const CredentialsSection: React.FC = () => {
  const { documents } = useProfileSync();

  // Combine standard certifications with user uploaded certifications/accreditations
  const customCerts = documents
    .filter((d) => d.category === 'Certification' || d.category === 'Accreditation' || d.category === 'Engineering License')
    .map((d) => ({
      title: d.title,
      issuer: d.issuer,
      date: d.date || 'Verified active',
      id: d.credentialId || d.id,
      verifiedLink: d.verifiedLink || '#',
      category: d.category,
    }));

  const displayedCertifications = customCerts.length > 0
    ? [...customCerts, ...CERTIFICATIONS.filter(c => !customCerts.some(cc => cc.title.toLowerCase() === c.title.toLowerCase()))]
    : CERTIFICATIONS;

  return (
    <section id="credentials" className="py-12 sm:py-16 border-t border-[#b8c6d4] bg-[#dce1e8] font-serif">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-cyan-800" />
              <span className="text-xs sm:text-sm font-sans font-bold text-cyan-900 uppercase tracking-wider">
                Verifiable Engineering Authority
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-950 tracking-tight mt-1">
              Verified Professional Credentials &amp; Standards
            </h2>
            <p className="text-base sm:text-lg text-slate-700 mt-1 max-w-2xl leading-relaxed">
              Every design decision is rooted in recognized engineering bodies and audited by official certification boards.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {displayedCertifications.map((cert, idx) => (
            <div
              key={idx}
              className="p-5 sm:p-6 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] hover:border-cyan-700 hover:bg-white transition-all flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md group"
            >
              <div>
                <div className="flex items-center justify-between text-xs sm:text-sm font-sans text-slate-600 mb-2">
                  <span className="text-cyan-900 font-bold">{cert.category}</span>
                  <span className="text-emerald-800 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Active</span>
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-950 group-hover:text-cyan-900 transition-colors">
                  {cert.title}
                </h3>

                <div className="mt-3 text-xs sm:text-sm text-slate-700 space-y-1 font-sans">
                  <div>Issuer: <span className="font-semibold text-slate-900">{cert.issuer}</span></div>
                  <div>Cert ID: <span className="font-mono text-cyan-950 font-bold">{cert.id}</span></div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#cbd5e1] flex items-center justify-between text-sm">
                <span className="text-slate-600 font-sans text-xs">{cert.date}</span>
                {cert.verifiedLink && cert.verifiedLink !== '#' ? (
                  <a
                    href={cert.verifiedLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-cyan-800 hover:text-cyan-950 hover:underline font-sans font-semibold text-xs"
                  >
                    <span>Verify</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="text-emerald-700 font-sans font-semibold text-xs flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Attached</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
