import pg from "pg";
import Q from "q";
import {
  pg_url,
} from "../config";

var client = new pg.Client(pg_url);
client.connect();


var query = function(text, values=[]) {
	return Q.Promise((resolve, reject) => {
		console.log({
			text: text,
			values: values
		})
		client.query({
			text: text,
			values: values
		}, function(err, res) {
			if (err) {
				reject(err);
			} else {
				resolve(res.rows);
			}
		})
	});
};

var prefix = function(user) {
	if (user.indexOf("@") !== 0) {
		return "@" + user;
	}
	return user;
}

var upsertUser = function(user) {
	var text = "INSERT INTO slackuser (id) SELECT $1::varchar WHERE NOT EXISTS (SELECT 1 FROM slackuser WHERE id = $1::varchar);";
	return query(text, [user]);
};

exports.logQuestion = function(ts, content, mentee) {
	mentee = prefix(mentee);
	return upsertUser(mentee).then(r => {
		return query("INSERT INTO question VALUES ($1, $2, $3, timezone('PST'::text, now()))", [
			ts,
			content,
			mentee,
		]);
	});
};

exports.logClaim = function(ts, mentor) {
	mentor = prefix(mentor);
	return upsertUser(mentor).then(r => {
		return query("INSERT INTO claim VALUES ($1, $2, timezone('PST'::text, now()))", [
			ts,
			mentor,
		]);
	});
};

exports.logDelete = function(ts, mentor) {
	mentor = prefix(mentor);
	return upsertUser(mentor).then(r => {
		return query("INSERT INTO delete VALUES ($1, $2, timezone('PST'::text, now()))", [
			ts,
			mentor,
		]);
	});
};

exports.logClaim("456", "@raphie").done();

