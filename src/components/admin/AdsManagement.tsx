'use client';

import { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaEye, FaEyeSlash } from 'react-icons/fa';

interface Ad {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  linkUrl?: string;
  position: 'top' | 'bottom' | 'sidebar';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdsManagement() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    imageUrl: '',
    linkUrl: '',
    position: 'bottom' as 'top' | 'bottom' | 'sidebar',
    isActive: true
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    try {
      const response = await fetch('/api/ads');
      if (response.ok) {
        const data = await response.json();
        setAds(data);
      }
    } catch (error) {
      console.error('Error fetching ads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingAd ? `/api/ads/${editingAd.id}` : '/api/ads';
      const method = editingAd ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        fetchAds();
        setShowForm(false);
        setEditingAd(null);
        setFormData({
          title: '',
          content: '',
          imageUrl: '',
          linkUrl: '',
          position: 'top',
          isActive: true
        });
      }
    } catch (error) {
      console.error('Error saving ad:', error);
    }
  };

  const handleEdit = (ad: Ad) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title,
      content: ad.content,
      imageUrl: ad.imageUrl || '',
      linkUrl: ad.linkUrl || '',
      position: ad.position || 'top',
      isActive: ad.isActive ?? true
    });
    setImageFile(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ad?')) return;

    try {
      const response = await fetch(`/api/ads/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchAds();
      }
    } catch (error) {
      console.error('Error deleting ad:', error);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    try {
      const res = await fetch('/api/ads/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileType: file.type }),
      });
      if (!res.ok) throw new Error('Failed to get upload URL');
      const { signedUrl, publicUrl, useLocalFallback } = await res.json();
      if (useLocalFallback) {
        // Use data URL for local fallback
        const reader = new FileReader();
        reader.onload = () => {
          setFormData({ ...formData, imageUrl: reader.result as string });
        };
        reader.readAsDataURL(file);
        return;
      }
      if (!signedUrl) {
        console.error('S3 not configured');
        return;
      }
      // Upload the file
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      setFormData({ ...formData, imageUrl: publicUrl });
    } catch (error) {
      console.error('Upload failed', error);
    }
  };

  const toggleAdStatus = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/ads/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (response.ok) {
        fetchAds();
      }
    } catch (error) {
      console.error('Error toggling ad status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0078d4]"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ads Management</h1>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingAd(null);
            setImageFile(null);
            setFormData({
              title: '',
              content: '',
              imageUrl: '',
              linkUrl: '',
              position: 'bottom',
              isActive: true
            });
          }}
          className="bg-gradient-to-r from-[#0078d4] to-[#00d09c] text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <FaPlus size={16} />
          Add New Ad
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {editingAd ? 'Edit Ad' : 'Create New Ad'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-[#0078d4]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-[#0078d4] h-24"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image (optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-[#0078d4]"
              />
              {formData.imageUrl && (
                <img src={formData.imageUrl} alt="Preview" className="mt-2 w-24 h-24 object-cover rounded" />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Link URL (optional)</label>
              <input
                type="url"
                value={formData.linkUrl}
                onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-[#0078d4]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <select
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value as 'top' | 'bottom' | 'sidebar' })}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-[#0078d4]"
              >
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="sidebar">Sidebar</option>
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active</label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
              >
                {editingAd ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingAd(null);
                  setImageFile(null);
                }}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {ads.map((ad) => (
              <tr key={ad.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{ad.title}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{ad.position}</td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    ad.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {ad.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAdStatus(ad.id, ad.isActive)}
                      className={`p-1 rounded ${
                        ad.isActive ? 'text-red-600 hover:text-red-500' : 'text-green-600 hover:text-green-500'
                      }`}
                      title={ad.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {ad.isActive ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                    </button>
                    <button
                      onClick={() => handleEdit(ad)}
                      className="text-blue-600 hover:text-blue-500 p-1"
                      title="Edit"
                    >
                      <FaEdit size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(ad.id)}
                      className="text-red-600 hover:text-red-500 p-1"
                      title="Delete"
                    >
                      <FaTrash size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ads.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No ads found. Create your first ad to get started.
          </div>
        )}
      </div>
    </div>
  );
}