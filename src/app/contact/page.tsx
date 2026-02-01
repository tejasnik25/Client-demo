'use client';

import React, { useState, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import UserLayout from '@/components/UserLayout';
import { FiMail, FiUser, FiMessageSquare, FiSend, FiCheckCircle, FiAlertCircle, FiPhone } from 'react-icons/fi';

function ContactContent() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    mobile: '',
    subject: '',
    message: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      setSuccess(true);
      setFormData({
        name: session?.user?.name || '',
        email: session?.user?.email || '',
        mobile: '',
        subject: '',
        message: ''
      });
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <UserLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Contact Support</h1>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Have a question or need assistance? Fill out the form below and our team will get back to you as soon as possible.
          </p>
        </div>

        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3">
            {/* Contact Info / Sidebar */}
            <div className="bg-[#0e1726] p-8 text-white flex flex-col justify-between">
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Get in touch</h3>
                <p className="text-gray-400 text-sm">
                  We're here to help you with any questions about our copy trading platform.
                </p>
                
                <div className="space-y-4 mt-8">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white/10 rounded-lg">
                      <FiMail className="w-5 h-5 text-[#E7000B]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Email us</p>
                      <p className="text-sm font-medium">tradeown3@gmail.com</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-12">
                <div className="w-full h-32 bg-gradient-to-br from-[#00d09c]/20 to-blue-600/20 rounded-xl flex items-center justify-center relative overflow-hidden">
                   <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-30"></div>
                   <FiMessageSquare className="w-12 h-12 text-white/20" />
                </div>
              </div>
            </div>

            {/* Form Section */}
            <div className="col-span-2 p-8 md:p-10">
              <form onSubmit={handleSubmit} className="space-y-6">
                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-3">
                    <FiCheckCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">Message sent successfully! We'll be in touch shortly.</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
                    <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium text-gray-700">Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiUser className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#00d09c] focus:border-transparent transition-all outline-none text-sm"
                        placeholder="Your name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiMail className="text-gray-400" />
                      </div>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#00d09c] focus:border-transparent transition-all outline-none text-sm"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="mobile" className="text-sm font-medium text-gray-700">Mobile Number</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiPhone className="text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        id="mobile"
                        name="mobile"
                        value={formData.mobile}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#00d09c] focus:border-transparent transition-all outline-none text-sm"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="subject" className="text-sm font-medium text-gray-700">Subject</label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      required
                      value={formData.subject}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#00d09c] focus:border-transparent transition-all outline-none text-sm"
                      placeholder="How can we help?"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium text-gray-700">Message</label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#00d09c] focus:border-transparent transition-all outline-none text-sm resize-none"
                    placeholder="Tell us more about your inquiry..."
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full md:w-auto px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>Processing...</>
                    ) : (
                      <>
                        Send Message
                        <FiSend className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ContactContent />
    </Suspense>
  );
}
