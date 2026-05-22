const API_BASE = 'http://localhost:8080/api';

class ApiService {
  constructor() {
    this.baseUrl = API_BASE;
  }

  getToken() {
    return localStorage.getItem('token');
  }

  getHeaders(includeAuth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (includeAuth) {
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  async request(method, endpoint, body = null, auth = true, timeoutMs = null) {
    const controller = timeoutMs ? new AbortController() : null;
    const timerId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    const config = {
      method,
      headers: this.getHeaders(auth),
      ...(controller ? { signal: controller.signal } : {}),
    };
    if (body) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);

      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Session expired');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed: ${response.status}`);
      }

      if (response.status === 204) return null;
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s. Please try again.`);
      }
      // If the java backend isn't running, this gives a much clearer error to the user!
      if (error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to the backend database. Is your Java Spring Boot app running on port 8080?');
      }
      throw error;
    } finally {
      if (timerId) clearTimeout(timerId);
    }
  }

  // Auth
  async register(data) {
    return this.request('POST', '/auth/register', data, false);
  }

  async login(data) {
    return this.request('POST', '/auth/login', data, false);
  }

  // Ideas
  async getIdeas(search = '', tag = '') {
    let query = '';
    if (search) query += `?search=${encodeURIComponent(search)}`;
    else if (tag) query += `?tag=${encodeURIComponent(tag)}`;
    return this.request('GET', `/ideas${query}`);
  }

  async getIdea(id) {
    return this.request('GET', `/ideas/${id}`);
  }

  async createIdea(data) {
    return this.request('POST', '/ideas', data);
  }

  async updateIdea(id, data) {
    return this.request('PUT', `/ideas/${id}`, data);
  }

  async deleteIdea(id) {
    return this.request('DELETE', `/ideas/${id}`);
  }

  // Content Analysis (AI CSV results)
  async getAnalyses() {
    return this.request('GET', '/ideas/analyses');
  }

  // Upload CSV for AI idea generation — with 115s AbortController timeout
  // type: "ideas" (default) or "analysis" — determines prompt and output format
  async uploadCsvIdea(file, type = 'ideas', onProgress) {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.getToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Do NOT set Content-Type — browser sets multipart boundary automatically

    // AbortController gives a clean timeout instead of hanging forever
    const controller = new AbortController();
    const TIMEOUT_MS = 115_000; // 115 seconds (backend kills at 110s)
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/ideas/upload-csv?type=${encodeURIComponent(type)}`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Session expired');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Analysis timed out after ~2 minutes. Your CSV may be too large — try uploading a smaller date range export from YouTube Studio.');
      }
      if (error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to backend. Is your Spring Boot app running on port 8080?');
      }
      throw error;
    }
  }

  // Scripts — AI calls use 65s timeout to match backend's 60s reactive timeout
  async generateScript(data) {
    return this.request('POST', '/script/generate', data, true, 65000);
  }

  async improveScript(data) {
    return this.request('POST', '/script/improve', data, true, 65000);
  }

  async generateHook(data) {
    return this.request('POST', '/script/hook', data, true, 65000);
  }

  async getScriptsByIdea(ideaId) {
    return this.request('GET', `/script/idea/${ideaId}`);
  }

  async saveManualScript(data) {
    return this.request('POST', '/script/save', data);
  }

  async updateScriptCanvas(scriptId, canvasData) {
    return this.request('PUT', `/script/${scriptId}/canvas`, { canvasData });
  }

  async analyzeScript(text) {
    return this.request('POST', '/script/analyze', { text });
  }

  async researchScript(text) {
    return this.request('POST', '/script/research', { text });
  }

  // Content Posts
  async getContentPosts() {
    return this.request('GET', '/content');
  }

  async createContentPost(data) {
    return this.request('POST', '/content', data);
  }

  async updateContentStatus(id, status) {
    return this.request('PUT', `/content/${id}/status`, { status });
  }

  // Schedule
  async schedulePost(postId, scheduledAt) {
    return this.request('POST', '/schedule', { postId, scheduledAt });
  }

  async getScheduledPosts(start, end) {
    let query = '';
    if (start) query += `?start=${start}`;
    if (end) query += `${query ? '&' : '?'}end=${end}`;
    return this.request('GET', `/schedule${query}`);
  }

  // Analytics
  async getAnalytics() {
    return this.request('GET', '/analytics');
  }

  // Recommendations
  async getRecommendation() {
    return this.request('GET', '/recommendation');
  }
}

const api = new ApiService();
export default api;
