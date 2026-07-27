const supabase = require('./supabaseClient');

async function diagnoseStorage() {
  console.log('--- Storage Diagnostics ---');
  if (!supabase) {
    console.error('❌ Supabase client is NOT initialized. Check SUPABASE_ANON_KEY.');
    return;
  }

  try {
    console.log('1. Listing buckets...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Failed to list buckets:', listError.message);
    } else {
      console.log('Buckets found:', buckets.map(b => b.name).join(', '));
      const targetBucket = buckets.find(b => b.name === 'creziax-assets');
      if (targetBucket) {
        console.log('✅ Target bucket "creziax-assets" EXISTS.');
        console.log('Public status:', targetBucket.public ? 'PUBLIC' : 'PRIVATE');
      } else {
        console.error('❌ Target bucket "creziax-assets" is MISSING.');
      }
    }

    console.log('\n2. Testing file list in "creziax-assets"...');
    const { data: files, error: fileError } = await supabase.storage
      .from('creziax-assets')
      .list('images');
    
    if (fileError) {
      console.error('❌ Failed to list files in "creziax-assets/images":', fileError.message);
    } else {
      console.log(`✅ Success! Found ${files.length} files in "images" folder.`);
      if (files.length > 0) {
        console.log('Sample file:', files[0].name);
      }
    }

  } catch (err) {
    console.error('❌ Diagnostic Exception:', err.message);
  }
  
  console.log('--- Diagnostics Complete ---');
}

diagnoseStorage();
