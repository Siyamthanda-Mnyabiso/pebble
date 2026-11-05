import subprocess, time, sys, datetime, os
env = dict(os.environ, PGPASSWORD="postgres")
PSQL = ["psql","-h","127.0.0.1","-p","54322","-U","supabase_admin","-d","postgres","-At","-v","ON_ERROR_STOP=0"]
def uid(k): return f"00000000-0000-0000-0000-0000000001{k:02d}"
def session(k, date, start, fire):
    sql = f"""select pg_sleep(greatest(0, {fire} - extract(epoch from clock_timestamp())));
begin;
select set_config('request.jwt.claims', json_build_object('sub','{uid(k)}','role','authenticated')::text, true);
set local role authenticated;
insert into public.bookings (reference, user_id, provider_slug, service, scheduled_date, start_time, address, price_cents)
 values ('RC{k}{start[:2]}{date[-2:]}', '{uid(k)}', 'concurrency-test', 'Clean', '{date}', '{start}', '1 Long Street, Cape Town', 1);
commit;"""
    return subprocess.Popen(PSQL+["-c",sql], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
def q(sql): return subprocess.run(PSQL+["-c",sql], env=env, capture_output=True, text=True).stdout.strip()
def race(jobs):
    fire = time.time()+8
    ps = [(k,d,s,session(k,d,s,fire)) for k,d,s in jobs]
    out=[]
    for k,d,s,p in ps:
        o,_ = p.communicate(); ok = "INSERT 0 1" in o
        err = [l for l in o.splitlines() if "ERROR" in l]
        out.append((k,d,s,ok,(err[0][:80] if err else "")))
    return out
today = datetime.date.today()
d1 = (today+datetime.timedelta(days=5)).isoformat()
d2 = (today+datetime.timedelta(days=6)).isoformat()
print("PHASE 1: 6 customers book the same slot", d1, "10:00 at the same instant")
r = race([(k,d1,"10:00") for k in range(1,7)])
for x in r: print("  customer",x[0], "BOOKED" if x[3] else "refused: "+x[4])
print("  booked:", sum(1 for x in r if x[3]), "(expect exactly 1); rows in DB:", q(f"select count(*) from public.bookings where provider_slug='concurrency-test' and scheduled_date='{d1}' and start_time='10:00'"))
print("PHASE 2: 5 customers book 08:00, 10:00, 12:00, 14:00, 16:00 on", d2, "(120 min jobs, 30 min buffer, max 3 a day)")
r = race([(k,d2,t) for k,t in zip(range(1,6),["08:00","10:00","12:00","14:00","16:00"])])
for x in r: print("  customer",x[0],x[2], "BOOKED" if x[3] else "refused: "+x[4])
rows = q(f"select start_time from public.bookings where provider_slug='concurrency-test' and scheduled_date='{d2}' order by 1").split()
print("  booked times:", rows)
mins=[int(t[:2])*60+int(t[3:5]) for t in rows]
overlap=[(a,b) for a in mins for b in mins if a<b and b < a+120+30]
print("  count <= 3:", len(rows)<=3, "| any overlap including buffer:", bool(overlap))
