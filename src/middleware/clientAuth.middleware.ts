"use client"

export async function getAccountDetails(): Promise<{ userName: string, email: string, exp: number } | null> {
    const token = localStorage.getItem('token');
    try {
        if (!token) {
            throw new Error('No token found');
        }
        const [, payloadBase64] = token.split('.');
        const payload = JSON.parse(atob(payloadBase64));
        if (payload.exp * 1000 < Date.now()) {
            localStorage.removeItem('token');
            throw new Error('Token expired');
        }
        if (!payload.userName || !payload.email) {
            localStorage.removeItem('token');
            throw new Error('Invalid token payload');
        }
        return payload;
    } catch {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refreshToken })
            })
            if (!response.ok) {
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                return null;
            }
            try {
                const data = await response.json();
                localStorage.setItem('token', data.token);
                const newPayload = JSON.parse(atob(data.token.split('.')[1]));
                return newPayload;
            } catch {
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
            }
        }
        return null
    }
}