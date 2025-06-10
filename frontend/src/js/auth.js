// Authentication Management
class Auth {
    static isLoggedIn() {
        const token = localStorage.getItem('authToken');
        const user = localStorage.getItem('currentUser');
        return !!(token && user);
    }

    static getCurrentUser() {
        const user = localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    }

    static setAuthData(token, user) {
        localStorage.setItem('authToken', token);
        localStorage.setItem('currentUser', JSON.stringify(user));
    }

    static clearAuthData() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
    }

    static async login(username, password) {
        try {
            // For now, we'll simulate a successful login
            // This will be replaced with actual API call once backend auth is implemented
            if (username && password) {
                const mockUser = {
                    id: 1,
                    username: username,
                    name: username.charAt(0).toUpperCase() + username.slice(1),
                    role: 'admin'
                };
                
                const mockToken = 'mock_jwt_token_' + Date.now();
                this.setAuthData(mockToken, mockUser);
                return { success: true, user: mockUser, token: mockToken };
            } else {
                throw new Error('Username and password required');
            }
            
            // Uncomment this when backend auth is ready:
            // const response = await API.login(username, password);
            // this.setAuthData(response.token, response.user);
            // return response;
            
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    static async logout() {
        try {
            // Uncomment when backend is ready:
            // await API.logout();
            
            this.clearAuthData();
            return { success: true };
        } catch (error) {
            console.error('Logout failed:', error);
            // Clear auth data anyway on logout failure
            this.clearAuthData();
            throw error;
        }
    }

    static async verifyAuth() {
        if (!this.isLoggedIn()) {
            return false;
        }

        try {
            // For now, just return true if we have stored auth data
            // Uncomment when backend is ready:
            // await API.verifyToken();
            return true;
        } catch (error) {
            console.error('Auth verification failed:', error);
            this.clearAuthData();
            return false;
        }
    }
}