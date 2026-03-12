// import { UserInsert, User, usersTable } from "@/db/schema";
// import { hash } from "crypto";
// import bcrypt from "bcrypt";

// // get drizzle instance
// import { db } from "@/db";

import { db } from '@/db';
import { hashPassword } from './password';
import { userAuditEventsTable, usersTable } from '@/db/schema';

async function createUsers() {
    // Delete all existing users
    await db.delete(usersTable);
    console.log('Deleted all existing users');

    // Create admin user
    const adminPassword = await hashPassword('admins');
    const [admin] = await db.insert(usersTable).values({
        name: 'Admin User',
        email: 'admin@tama.org',
        hashedPassword: adminPassword,
        isAdmin: true,
        origin: 'seed',
        status: 'active',
    }).returning({ id: usersTable.id });

    // Create student user
    const studentPassword = await hashPassword('students');
    const [student] = await db.insert(usersTable).values({
        name: 'Student User',
        email: 'student@tama.org',
        hashedPassword: studentPassword,
        isAdmin: false,
        origin: 'seed',
        status: 'active',
    }).returning({ id: usersTable.id });

    await db.insert(userAuditEventsTable).values([
        {
            actorUserId: null,
            targetUserId: admin.id,
            action: 'user_activated',
            source: 'script_seed',
            metadataJson: JSON.stringify({ email: 'admin@tama.org', origin: 'seed' }),
        },
        {
            actorUserId: null,
            targetUserId: student.id,
            action: 'user_activated',
            source: 'script_seed',
            metadataJson: JSON.stringify({ email: 'student@tama.org', origin: 'seed' }),
        },
    ]);

    console.log('Users created successfully!');
}

createUsers().catch(console.error);
