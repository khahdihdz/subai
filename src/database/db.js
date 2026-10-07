import Database from 'better-sqlite3';
import path from 'node:path'; import fs from 'node:fs'; import {config} from '../config/config.js';
fs.mkdirSync(config.storage,{recursive:true}); export const db=new Database(path.join(config.storage,'subai.db')); db.pragma('journal_mode=WAL');
db.exec(`CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,filename TEXT,status TEXT NOT NULL,progress INTEGER DEFAULT 0,source_language TEXT,target_language TEXT,created_at TEXT,updated_at TEXT,output_files TEXT,error TEXT)`);
export const createJob=j=>db.prepare(`INSERT INTO jobs VALUES(@id,@filename,@status,@progress,@source_language,@target_language,@created_at,@updated_at,@output_files,@error)`).run({...j,output_files:'[]',error:null});
export const getJob=id=>db.prepare('SELECT * FROM jobs WHERE id=?').get(id); export const listJobs=()=>db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 100').all();
export const updateJob=(id,p)=>db.prepare(`UPDATE jobs SET ${Object.keys(p).map(k=>`${k}=@${k}`).join(',')},updated_at=@updated_at WHERE id=@id`).run({...p,id,updated_at:new Date().toISOString()});
export const recoverJobs=()=>db.prepare("UPDATE jobs SET status='failed',error='Server restarted while job was processing',updated_at=? WHERE status='processing'").run(new Date().toISOString());