import { login } from "./actions";
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const p = await searchParams;
  return <main className="container section"><form className="form-card" action={login} style={{maxWidth:520,margin:"auto"}}>
    <p className="eyebrow">PRIVATE VAULT ACCESS</p><h1>Admin Login</h1>
    {p.error && <p className="message error">{p.error}</p>}
    <div className="field"><label>Email</label><input name="email" type="email" required/></div><br/>
    <div className="field"><label>Password</label><input name="password" type="password" required/></div><br/>
    <button className="btn">ENTER ADMIN</button>
  </form></main>;
}
