import pg from "pg";
import query from "pg-query";
import Q from "q";
import {
  pg_url,
} from "../config";


query.connectionParameters = pg_url


var queryP = function(text, values=[]) {
	return Q.Promise((resolve, reject) => {
		console.log({
			text: text,
			values: values
		})
		query(text, values, function(err, rows, result) {
			if (err) {
				reject(err);
			} else {
				resolve(rows);
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
	return queryP(text, [user]);
};

exports.logQuestion = function(ts, content, mentee) {
	mentee = prefix(mentee);
	return upsertUser(mentee).then(r => {
		return queryP("INSERT INTO question VALUES ($1, $2, $3, timezone('PST'::text, now()))", [
			ts,
			content,
			mentee,
		]);
	});
};

exports.logClaim = function(ts, mentor) {
	mentor = prefix(mentor);
	return upsertUser(mentor).then(r => {
		return queryP("INSERT INTO claim VALUES ($1, $2, timezone('PST'::text, now()))", [
			ts,
			mentor,
		]);
	});
};

exports.logDelete = function(ts, mentor) {
	mentor = prefix(mentor);
	return upsertUser(mentor).then(r => {
		return queryP("INSERT INTO delete VALUES ($1, $2, timezone('PST'::text, now()))", [
			ts,
			mentor,
		]);
	});
};
