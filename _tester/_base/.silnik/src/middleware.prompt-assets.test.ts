import {middleware} from './middleware';
import {NextResponse,type NextRequest} from 'next/server';
import createMiddleware from 'next-intl/middleware';
jest.mock('./i18n/routing',()=>({routing:{}}));
jest.mock('next/server',()=>({NextResponse:{next:jest.fn(()=>({kind:'static'}))}}));
jest.mock('next-intl/middleware',()=>({__esModule:true,default:jest.fn(()=>jest.fn(()=>({kind:'localized'})))}));
const request=(pathname:string)=>({nextUrl:{pathname},headers:{get:()=>null}}) as unknown as NextRequest;
test.each(['/default-gm-prompt.md','/default-gm-prompt-en.md'])('serves the exact prompt asset without locale redirects: %s',path=>{
 jest.mocked(NextResponse.next).mockClear();
 middleware(request(path));
 expect(NextResponse.next).toHaveBeenCalledTimes(1);
});
test('ordinary pages still use locale routing',()=>{
 const intl=jest.mocked(createMiddleware).mock.results[0].value;intl.mockClear();
 middleware(request('/settings'));expect(intl).toHaveBeenCalledTimes(1);
});
