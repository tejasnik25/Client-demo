import { NextResponse } from 'next/server';
import pool from '../../../db/db';

export async function GET() {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    return NextResponse.json({ message: 'Database connected', result: rows });
  } catch (error) {
    return NextResponse.json({ error: 'Database connection failed', details: error.message }, { status: 500 });
  }
}