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
            const response = await API.login(username, password); // API.login actually returns the full server response which has a 'data' property
            if (response && response.data && response.data.token && response.data.user) {
                this.setAuthData(response.data.token, response.data.user); // Use response.data.token and response.data.user
                // Optionally, also store refreshToken if you plan to use it: response.data.refreshToken
                return { success: true, user: response.data.user, token: response.data.token };
            } else {
                // Try to get a more specific error message if available from the server response
                const errorMessage = response && response.message ? response.message : 'Login failed: Invalid response structure from server';
                throw new Error(response.error || errorMessage);
            }
        } catch (error) {
            console.error('Login failed:', error);
            this.clearAuthData(); // Ensure no partial auth data is stored
            throw error;
        }
    }

    static async logout() {
        try {
            await API.logout();
            this.clearAuthData();
            return { success: true };
        } catch (error) {
            console.error('Logout failed:', error);
            // Clear auth data anyway on logout failure, even if API call fails
            this.clearAuthData();
            throw error;
        }
    }

    static async verifyAuth() {
        if (!this.isLoggedIn()) {
            return false;
        }

        try {
            await API.verifyToken();
            return true;
        } catch (error) {
            console.error('Auth verification failed:', error);
            this.clearAuthData();
            return false;
        }
    }
}