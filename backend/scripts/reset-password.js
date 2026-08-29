#!/usr/bin/env node
'use strict';
const crypto=require('crypto');
const {DatabaseSync}=require('node:sqlite');
const user=process.argv[2], password=process.env.NEW_PASSWORD, dbPath=process.env.DB_PATH||'/data/fasttrack.db';
if(!user||!password){console.error('Usage: NEW_PASSWORD="a-long-unique-password" node backend/scripts/reset-password.js USERNAME');process.exit(1)}
if(password.length<15||Buffer.byteLength(password,'utf8')>128){console.error('Password must be 15-128 UTF-8 bytes.');process.exit(1)}
const scrypt=(p,s)=>new Promise((resolve,reject)=>crypto.scrypt(p,s,64,{N:1<<15,r:8,p:1,maxmem:64*1024*1024},(e,k)=>e?reject(e):resolve(k)));
(async()=>{const db=new DatabaseSync(dbPath,{timeout:5000,defensive:true,enableForeignKeyConstraints:true,allowExtension:false});try{const row=db.prepare('SELECT id,username FROM users WHERE username=? COLLATE NOCASE').get(user);if(!row)throw new Error('User not found');const salt=crypto.randomBytes(16).toString('base64url'),key=await scrypt(password,salt),hash=`scrypt$${salt}$${key.toString('base64url')}`;db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE users SET password_hash=?,updated_at=? WHERE id=?').run(hash,new Date().toISOString(),row.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.id);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}console.log(`Password reset for ${row.username}; all sessions revoked.`)}finally{db.close()}})().catch(e=>{console.error(e.message);process.exit(1)});
