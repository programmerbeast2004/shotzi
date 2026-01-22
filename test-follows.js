const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://llnkxxbplosswrskrbkc.supabase.co', 'sb_publishable_l2n5W3ILhOKtnAdbovVBMw_tWok2ayk');

async function testFollows() {
  console.log('Testing follows table...');

  // Check follows table structure
  const { data: follows, error } = await supabase
    .from('follows')
    .select('*')
    .limit(5);

  console.log('Follows data:', follows);
  console.log('Error:', error);

  if (follows && follows.length > 0) {
    console.log('Sample follow:', follows[0]);
  }
}

testFollows().catch(console.error);