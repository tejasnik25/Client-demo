import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { readDatabase, writeDatabase, type User } from '@/db/dbService';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user already exists
    const db = readDatabase();
    const existingUser = db.users.find((user: User) => user.email === email);

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser: User = {
      id: uuidv4(),
      name,
      email,
      email_verified: false,
      password: hashedPassword,
      role: 'USER',
      wallet_balance: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add user to the database
    db.users.push(newUser);
    
    // In Vercel, we'll store the user in memory only
    // This is fine for demo purposes
    if (!process.env.VERCEL) {
      try {
        writeDatabase(db);
      } catch (writeError) {
        console.error('Error writing to database file:', writeError);
      }
    } else {
      console.log('Vercel environment detected - user registered in memory only');
    }

    return NextResponse.json({ success: true, message: 'User registered successfully', userId: newUser.id }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}