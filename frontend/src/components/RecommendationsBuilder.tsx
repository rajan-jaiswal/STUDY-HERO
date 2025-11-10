import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type TopicType = 'assignment' | 'pbl' | 'research';

type Recommendation = {
  id: string;
  title: string;
  description: string;
  type: TopicType;
  publishAt?: string;
  isPublished: boolean;
  source: 'ai-generated' | 'manual';
  pdfContent?: string;
};

type Props = {
  pdfContent?: string;
  onCreated?: (recommendations: Recommendation[]) => void;
};

const RecommendationsBuilder: React.FC<Props> = ({ pdfContent, onCreated }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [activeTab, setActiveTab] = useState<TopicType>('assignment');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState({
    title: '',
    description: '',
    type: 'assignment' as TopicType,
    publishAt: ''
  });

  // AI-powered topic extraction from PDF content
  const extractTopicsFromPDF = (content: string): { assignments: string[], pbl: string[], research: string[] } => {
    const text = content.toLowerCase();
    
    // Assignment topics based on common academic patterns
    const assignmentKeywords = [
      'analysis', 'report', 'essay', 'summary', 'review', 'critique', 'evaluation',
      'comparison', 'discussion', 'explanation', 'description', 'investigation',
      'case study', 'problem solving', 'calculation', 'demonstration'
    ];
    
    // PBL (Project-Based Learning) topics
    const pblKeywords = [
      'project', 'design', 'build', 'create', 'develop', 'implement', 'construct',
      'prototype', 'solution', 'innovation', 'collaboration', 'real-world',
      'application', 'practical', 'hands-on', 'experiment'
    ];
    
    // Research paper topics
    const researchKeywords = [
      'research', 'study', 'investigation', 'hypothesis', 'methodology', 'data analysis',
      'literature review', 'findings', 'conclusion', 'thesis', 'dissertation',
      'empirical', 'quantitative', 'qualitative', 'survey', 'experiment'
    ];
    
    const assignments: string[] = [];
    const pbl: string[] = [];
    const research: string[] = [];
    
    // Extract sentences and generate topic suggestions
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();
      
      // Assignment topics
      if (assignmentKeywords.some(keyword => lowerSentence.includes(keyword))) {
        const topic = sentence.trim().substring(0, 100) + '...';
        if (!assignments.includes(topic)) {
          assignments.push(topic);
        }
      }
      
      // PBL topics
      if (pblKeywords.some(keyword => lowerSentence.includes(keyword))) {
        const topic = sentence.trim().substring(0, 100) + '...';
        if (!pbl.includes(topic)) {
          pbl.push(topic);
        }
      }
      
      // Research topics
      if (researchKeywords.some(keyword => lowerSentence.includes(keyword))) {
        const topic = sentence.trim().substring(0, 100) + '...';
        if (!research.includes(topic)) {
          research.push(topic);
        }
      }
    });
    
    // Generate additional topic suggestions based on content themes
    const themes = extractThemes(content);
    themes.forEach(theme => {
      if (assignments.length < 5) {
        assignments.push(`Write an analysis report on ${theme}`);
      }
      if (pbl.length < 5) {
        pbl.push(`Design and implement a project related to ${theme}`);
      }
      if (research.length < 5) {
        research.push(`Conduct research on ${theme}: A comprehensive study`);
      }
    });
    
    return {
      assignments: assignments.slice(0, 5),
      pbl: pbl.slice(0, 5),
      research: research.slice(0, 5)
    };
  };
  
  const extractThemes = (content: string): string[] => {
    const themes: string[] = [];
    const words = content.toLowerCase().split(/\s+/);
    const wordCount: { [key: string]: number } = {};
    
    // Count word frequency
    words.forEach(word => {
      if (word.length > 4) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });
    
    // Get most frequent words as themes
    const sortedWords = Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
    
    return sortedWords;
  };

  const generateRecommendations = async () => {
    if (!pdfContent) {
      alert('No PDF content available for generating recommendations');
      return;
    }
    
    setGenerating(true);
    try {
      const extracted = extractTopicsFromPDF(pdfContent);
      const newRecommendations: Recommendation[] = [];
      
      // Convert extracted topics to recommendations
      extracted.assignments.forEach((title, index) => {
        newRecommendations.push({
          id: `assignment-${Date.now()}-${index}`,
          title,
          description: `Assignment topic generated from PDF content`,
          type: 'assignment',
          isPublished: false,
          source: 'ai-generated',
          pdfContent
        });
      });
      
      extracted.pbl.forEach((title, index) => {
        newRecommendations.push({
          id: `pbl-${Date.now()}-${index}`,
          title,
          description: `PBL topic generated from PDF content`,
          type: 'pbl',
          isPublished: false,
          source: 'ai-generated',
          pdfContent
        });
      });
      
      extracted.research.forEach((title, index) => {
        newRecommendations.push({
          id: `research-${Date.now()}-${index}`,
          title,
          description: `Research topic generated from PDF content`,
          type: 'research',
          isPublished: false,
          source: 'ai-generated',
          pdfContent
        });
      });
      
      setRecommendations(prev => [...prev, ...newRecommendations]);
      
      // Save to localStorage
      const existing = JSON.parse(localStorage.getItem('recommendations') || '[]');
      const updated = [...existing, ...newRecommendations];
      localStorage.setItem('recommendations', JSON.stringify(updated));
      
    } catch (error) {
      console.error('Error generating recommendations:', error);
      alert('Failed to generate recommendations');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddTopic = () => {
    if (!newTopic.title.trim() || !newTopic.description.trim()) {
      alert('Please fill in all fields');
      return;
    }
    
    const topic: Recommendation = {
      id: `manual-${Date.now()}`,
      title: newTopic.title.trim(),
      description: newTopic.description.trim(),
      type: newTopic.type,
      publishAt: newTopic.publishAt || undefined,
      isPublished: false,
      source: 'manual'
    };
    
    setRecommendations(prev => [...prev, topic]);
    
    // Save to localStorage
    const existing = JSON.parse(localStorage.getItem('recommendations') || '[]');
    const updated = [...existing, topic];
    localStorage.setItem('recommendations', JSON.stringify(updated));
    
    setNewTopic({ title: '', description: '', type: 'assignment', publishAt: '' });
    setShowAddForm(false);
  };

  const handleEditTopic = (id: string) => {
    const topic = recommendations.find(r => r.id === id);
    if (topic) {
      setNewTopic({
        title: topic.title,
        description: topic.description,
        type: topic.type,
        publishAt: topic.publishAt || ''
      });
      setEditingId(id);
      setShowAddForm(true);
    }
  };

  const handleUpdateTopic = () => {
    if (!editingId || !newTopic.title.trim() || !newTopic.description.trim()) {
      alert('Please fill in all fields');
      return;
    }
    
    setRecommendations(prev => prev.map(r => 
      r.id === editingId 
        ? { 
            ...r, 
            title: newTopic.title.trim(),
            description: newTopic.description.trim(),
            type: newTopic.type,
            publishAt: newTopic.publishAt || undefined
          }
        : r
    ));
    
    // Update localStorage
    const existing = JSON.parse(localStorage.getItem('recommendations') || '[]');
    const updated = existing.map((r: Recommendation) => 
      r.id === editingId 
        ? { 
            ...r, 
            title: newTopic.title.trim(),
            description: newTopic.description.trim(),
            type: newTopic.type,
            publishAt: newTopic.publishAt || undefined
          }
        : r
    );
    localStorage.setItem('recommendations', JSON.stringify(updated));
    
    setNewTopic({ title: '', description: '', type: 'assignment', publishAt: '' });
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleDeleteTopic = (id: string) => {
    if (!confirm('Are you sure you want to delete this topic?')) return;
    
    setRecommendations(prev => prev.filter(r => r.id !== id));
    
    // Update localStorage
    const existing = JSON.parse(localStorage.getItem('recommendations') || '[]');
    const updated = existing.filter((r: Recommendation) => r.id !== id);
    localStorage.setItem('recommendations', JSON.stringify(updated));
  };

  const handlePublishTopic = (id: string) => {
    setRecommendations(prev => prev.map(r => 
      r.id === id ? { ...r, isPublished: true } : r
    ));
    
    // Update localStorage
    const existing = JSON.parse(localStorage.getItem('recommendations') || '[]');
    const updated = existing.map((r: Recommendation) => 
      r.id === id ? { ...r, isPublished: true } : r
    );
    localStorage.setItem('recommendations', JSON.stringify(updated));
    
    alert('Topic published successfully!');
  };

  const handleUnpublishTopic = (id: string) => {
    setRecommendations(prev => prev.map(r => 
      r.id === id ? { ...r, isPublished: false } : r
    ));
    
    // Update localStorage
    const existing = JSON.parse(localStorage.getItem('recommendations') || '[]');
    const updated = existing.map((r: Recommendation) => 
      r.id === id ? { ...r, isPublished: false } : r
    );
    localStorage.setItem('recommendations', JSON.stringify(updated));
    
    alert('Topic unpublished successfully!');
  };

  const getTypeLabel = (type: TopicType) => {
    switch (type) {
      case 'assignment': return 'Assignment';
      case 'pbl': return 'PBL Project';
      case 'research': return 'Research Paper';
      default: return type;
    }
  };

  const getTypeIcon = (type: TopicType) => {
    switch (type) {
      case 'assignment': return 'ri-file-text-line';
      case 'pbl': return 'ri-tools-line';
      case 'research': return 'ri-search-line';
      default: return 'ri-file-line';
    }
  };

  const filteredRecommendations = recommendations.filter(r => r.type === activeTab);

  useEffect(() => {
    // Load existing recommendations from localStorage
    const existing = JSON.parse(localStorage.getItem('recommendations') || '[]');
    setRecommendations(existing);
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Academic Recommendations</h2>
        <div className="flex space-x-2">
          {pdfContent && (
            <button
              onClick={generateRecommendations}
              disabled={generating}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate from PDF'}
            </button>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            <i className="ri-add-line mr-1"></i>
            Add Manually
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
        {(['assignment', 'pbl', 'research'] as TopicType[]).map(type => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === type
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <i className={`${getTypeIcon(type)} mr-2`}></i>
            {getTypeLabel(type)}
          </button>
        ))}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4">
            {editingId ? 'Edit Topic' : 'Add New Topic'}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={newTopic.type}
                onChange={(e) => setNewTopic({ ...newTopic, type: e.target.value as TopicType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="assignment">Assignment</option>
                <option value="pbl">PBL Project</option>
                <option value="research">Research Paper</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={newTopic.title}
                onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
                placeholder="Enter topic title"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={newTopic.description}
                onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })}
                placeholder="Enter topic description"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Publish Date/Time (optional)</label>
              <input
                type="datetime-local"
                value={newTopic.publishAt}
                onChange={(e) => setNewTopic({ ...newTopic, publishAt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={editingId ? handleUpdateTopic : handleAddTopic}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
              >
                {editingId ? 'Update Topic' : 'Add Topic'}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingId(null);
                  setNewTopic({ title: '', description: '', type: 'assignment', publishAt: '' });
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredRecommendations.length === 0 ? (
          <div className="text-center py-8">
            <i className={`${getTypeIcon(activeTab)} text-4xl text-gray-300 mb-2`}></i>
            <p className="text-gray-500">No {getTypeLabel(activeTab).toLowerCase()} topics yet</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-3 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Add {getTypeLabel(activeTab)}
            </button>
          </div>
        ) : (
          filteredRecommendations.map(topic => (
            <div key={topic.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <i className={`${getTypeIcon(topic.type)} text-primary`}></i>
                    <h3 className="font-medium text-gray-800">{topic.title}</h3>
                    {topic.source === 'ai-generated' && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        AI Generated
                      </span>
                    )}
                    {topic.isPublished ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        Published
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                        Draft
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{topic.description}</p>
                  
                  {topic.publishAt && (
                    <p className="text-xs text-gray-500">
                      <i className="ri-calendar-line mr-1"></i>
                      Publish: {new Date(topic.publishAt).toLocaleString()}
                    </p>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditTopic(topic.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    <i className="ri-edit-line mr-1"></i>
                    Edit
                  </button>
                  <button
                    onClick={() => topic.isPublished ? handleUnpublishTopic(topic.id) : handlePublishTopic(topic.id)}
                    className={`text-sm ${
                      topic.isPublished 
                        ? 'text-orange-600 hover:text-orange-800' 
                        : 'text-green-600 hover:text-green-800'
                    }`}
                  >
                    <i className={`ri-${topic.isPublished ? 'eye-off' : 'eye'}-line mr-1`}></i>
                    {topic.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => handleDeleteTopic(topic.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    <i className="ri-delete-bin-line mr-1"></i>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecommendationsBuilder;
