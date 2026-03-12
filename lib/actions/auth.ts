'use server';
import { loginFormSchema } from '@/forms/login';
import { redirect } from 'next/navigation';
import { createSession, deleteSession } from '../session';
import { verifyAuth } from '../dal';
import { db } from '@/db';
import { verifyPassword } from '../password';
import { eq } from 'drizzle-orm';
import { usersTable } from '@/db/schema';

type LoginError = {
    errors: {
        email?: string[];
        password?: string[];
    };
    message: string;
};

export async function getUser() {
    const { user } = await verifyAuth();
    return user;
}

export async function handleLogout() {
    deleteSession();
    redirect('/login');
}

export async function handleLogin(prevState: any, formData: FormData): Promise<LoginError> {
    // validate form data
    const validatedFields = loginFormSchema.safeParse({
        email: formData.get('email'),
        password: formData.get('password'),
    });
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Please check your input and try again',
        };
    }

    // find user and check if they exist
    const user = await db.query.usersTable.findFirst({
        where: (usersTable, { eq }) =>
            eq(usersTable.email, validatedFields.data.email),
    });

    // Use the same generic message for both non-existent user and wrong password
    const genericError = {
        errors: {
            email: ['Invalid email or password'],
            password: ['Invalid email or password'],
        },
        message: 'Invalid email or password',
    };

    if (!user) {
        return genericError;
    }
    if (user.status !== 'active') {
        return genericError;
    }

    // check if passwords match
    const match = await verifyPassword(
        validatedFields.data.password,
        user.hashedPassword
    );
    if (!match) {
        return genericError;
    }

    // create session
    try {
        await createSession(user.email);
        await db
            .update(usersTable)
            .set({ lastLoginAt: new Date(), updatedAt: new Date(), updatedByUserId: user.id })
            .where(eq(usersTable.id, user.id));
    } catch (error) {
        return {
            errors: {
                email: [],
                password: [],
            },
            message: 'Failed to create session. Please try again later.',
        };
    }

    redirect('/app');
    return genericError; // This will never be reached due to redirect, but TypeScript needs it
}
