const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'admin',
  database: 'stock_analysis_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Replicate the fixed createUser function
async function testCreateUser(nameOrConfig, email, passwordPlain) {
  try {
    // Support both object and positional arguments
    let name;
    let userEmail;
    let password;
    
    if (typeof nameOrConfig === 'object') {
      // Object format: { name, email, password }
      name = nameOrConfig.name;
      userEmail = nameOrConfig.email;
      password = nameOrConfig.password;
    } else {
      // Positional arguments: (name, email, password)
      name = nameOrConfig;
      userEmail = email;
      password = passwordPlain;
    }
    
    if (!name || !userEmail || !password) {
      return { success: false, error: 'Missing required fields: name, email, password' };
    }
    
    const conn = await pool.getConnection();
    
    const id = `user_${Date.now()}`;
    const hashedPassword = await bcrypt.hash(password, 10);
    await conn.execute(
      'INSERT INTO users (id, name, email, password, role, created_at) VALUES (?, ?, ?, ?, "USER", CURRENT_TIMESTAMP)',
      [id, name, userEmail.toLowerCase(), hashedPassword]
    );
    
    conn.release();
    return { success: true, user: { id, name, email: userEmail.toLowerCase(), role: 'USER' } };
  } catch (error) {
    console.error('createUser failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function test() {
  console.log('\n=== TESTING FIXED createUser FUNCTION ===\n');
  
  // Test 1: Object format (what the register handler uses)
  console.log('Test 1: Object format (register handler style)');
  const result1 = await testCreateUser({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'SecurePass123'
  });
  console.log('Result:', result1);
  console.log(result1.success ? '✓ PASS\n' : '✗ FAIL\n');
  
  // Test 2: Positional format (backward compatibility)
  console.log('Test 2: Positional format (backward compatibility)');
  const result2 = await testCreateUser(
    'Jane Smith',
    'jane@example.com',
    'AnotherPass456'
  );
  console.log('Result:', result2);
  console.log(result2.success ? '✓ PASS\n' : '✗ FAIL\n');
  
  // Test 3: Missing password (should error)
  console.log('Test 3: Missing password (should error)');
  const result3 = await testCreateUser({
    name: 'Test User',
    email: 'test@example.com'
    // password missing
  });
  console.log('Result:', result3);
  console.log(result3.success === false ? '✓ PASS\n' : '✗ FAIL\n');
  
  // Verify users were created
  console.log('=== VERIFICATION ===\n');
  const conn = await pool.getConnection();
  const [users] = await conn.execute('SELECT id, name, email FROM users WHERE email IN (?, ?) ORDER BY created_at DESC', 
    ['john@example.com', 'jane@example.com']);
  console.log('Created users:');
  console.table(users);
  
  conn.release();
  process.exit(0);
}

test();
