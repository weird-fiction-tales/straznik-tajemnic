import {test,expect} from '@playwright/test';
for(const locale of ['pl','en'] as const){
 test('one prepared Quick Start adventure in '+locale,async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(selected=>{
   localStorage.clear();
   for(const key of ['onboarding_completed','rules_onboarding_completed','session_zero_completed','straznik_beta_welcome_dismissed'])localStorage.setItem(key,'true');
   localStorage.setItem('health_check_last_run',String(Date.now()));
   localStorage.setItem('language_selected',selected);
   localStorage.setItem('zew-app-api-keys',JSON.stringify({GEMINI_API_KEY:'e2e-local-key'}));
   localStorage.setItem('pdf_memory',JSON.stringify({rulesUrl:'/data/rag/rules.json'}));
  },locale);
  await page.route('**/api/**',route=>{
   if(route.request().url().includes('/api/desktop/update/check'))return route.continue();
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,recordCount:1,hasBaseRules:true})});
  });
  await page.goto('/'+locale);
  await page.getByTestId('btn-quick-setup').click();
  const modal=page.getByTestId('quick-setup-modal');
  await expect(modal).toBeVisible();
  const adventures=modal.locator('button[aria-label][aria-pressed]');
  await expect(adventures).toHaveCount(1);
  await expect(adventures).toHaveAttribute('aria-pressed','true');
  await expect(adventures).toHaveAttribute('aria-label',locale==='pl'?/Cień nad Prabutami/:/Englewood/);
  const person=locale==='pl'?'Tomasz Nowicki':'Det. Frank Geyer';
  await expect(modal.getByText(person,{exact:true})).toBeVisible();
  await expect(modal.getByRole('button',{name:locale==='pl'?'Rozpocznij przygodę':'Start adventure',exact:true})).toBeEnabled();
  await expect(page.locator('body')).not.toContainText('MISSING_MESSAGE');
  await page.screenshot({path:'test-results/quick-start-'+locale+'.png'});
  expect(errors).toEqual([]);
 });
}
