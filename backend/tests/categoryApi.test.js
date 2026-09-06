const http = require('http');
const app = require('../src/server');

let server;
const PORT = 5099;

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 Running Category Manager API & Raw SQL Contract Tests...');
  console.log('🧪 ========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  server = app.listen(PORT);

  try {
    // Test 1: GET /api/categories
    console.log('--- 1. Testing GET /api/categories ---');
    const res1 = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/categories',
      method: 'GET'
    });
    assert(res1.status === 200, 'GET /api/categories returns 200 OK');
    assert(res1.data.success === true, 'Response has success: true');
    assert(Array.isArray(res1.data.data), 'Response data is an Array');
    assert(res1.data.data.length > 0, 'Seed categories returned');
    const firstCat = res1.data.data[0];
    assert(typeof firstCat.id === 'number', 'Category id is INT (Number) matching foreign key');
    assert(typeof firstCat.name === 'string', 'Category name is VARCHAR (String)');

    // Test 2: GET /api/categories/stats
    console.log('\n--- 2. Testing GET /api/categories/stats ---');
    const resStats = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/categories/stats',
      method: 'GET'
    });
    assert(resStats.status === 200, 'GET /api/categories/stats returns 200');
    assert(typeof resStats.data.data.total_categories === 'number', 'Stats includes total_categories count');

    // Test 3: POST /api/categories (Creation with raw SQL)
    console.log('\n--- 3. Testing POST /api/categories ---');
    const newCatPayload = {
      name: 'HVAC & Air Duct Cleaning',
      description: 'Heating, ventilation, and air conditioning maintenance.',
      icon: 'wind',
      is_active: 1
    };
    const resPost = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/categories',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, newCatPayload);
    assert(resPost.status === 201, 'POST /api/categories returns 201 Created');
    assert(resPost.data.success === true, 'Creation response has success: true');
    assert(typeof resPost.data.data.id === 'number', 'Generated category id is integer');
    assert(resPost.data.data.name === newCatPayload.name, 'Category name matches payload');
    const createdId = resPost.data.data.id;

    // Test 4: Duplicate Name check (409 Conflict)
    console.log('\n--- 4. Testing Duplicate Category Name Protection ---');
    const resDup = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/categories',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, newCatPayload);
    assert(resDup.status === 409, 'Duplicate category name returns 409 Conflict');

    // Test 5: GET /api/categories/:id
    console.log('\n--- 5. Testing GET /api/categories/:id ---');
    const resGetOne = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/categories/${createdId}`,
      method: 'GET'
    });
    assert(resGetOne.status === 200, 'GET /api/categories/:id returns 200');
    assert(resGetOne.data.data.id === createdId, 'Fetched category ID matches requested ID');

    // Test 6: PUT /api/categories/:id (Update with raw SQL)
    console.log('\n--- 6. Testing PUT /api/categories/:id ---');
    const updatePayload = {
      name: 'HVAC & Duct Sanitization',
      description: 'Updated comprehensive heating, ventilation, and duct sanitization.',
      icon: 'shield-check',
      is_active: 1
    };
    const resPut = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/categories/${createdId}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, updatePayload);
    assert(resPut.status === 200, 'PUT /api/categories/:id returns 200');
    assert(resPut.data.data.name === updatePayload.name, 'Category name updated');
    assert(resPut.data.data.description === updatePayload.description, 'Category description updated');

    // Test 7: DELETE /api/categories/:id (Delete with raw SQL)
    console.log('\n--- 7. Testing DELETE /api/categories/:id ---');
    const resDelete = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/categories/${createdId}`,
      method: 'DELETE'
    });
    assert(resDelete.status === 200, 'DELETE /api/categories/:id returns 200');

    // Test 8: Verify Deletion
    const resVerify = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/categories/${createdId}`,
      method: 'GET'
    });
    assert(resVerify.status === 404, 'Deleted category returns 404 Not Found');

    console.log('\n========================================================');
    console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('========================================================\n');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('❌ Test execution error:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
