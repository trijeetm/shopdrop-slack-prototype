import Q from "q";
import Slack from "./slack.js";
import tags from "./tags.js";
import {
  bot_token,
  admin_token,
  bot_port,
  mentor_group_name,
} from "../config";
import {
  logQuestion,
  logClaim,
  logDelete,
} from "./logger.js";

var api = new Slack(bot_token)
api.listenForCommands("/commands", bot_port);
api.startConnection();

api.on("command", function*(data, res) {
  if (!data.text) {
    res.send("Please add a description of your problem, like /mentor how can I use an API?");
    return;
  }
  res.send("Your question has been submitted to the mentors! We'll let you know when someone's on it.");
  var userInfo = yield api.slackApi("users.info", {user: data.user_id});
  var name = userInfo.user.profile.real_name;
  var image = userInfo.user.profile.image_24;
  var mentorPost = yield api.slackApi("chat.postMessage", {
    channel: mentor_group_name,
    as_user: true,
    text: "Hit the (:raising_hand: 1) below to claim this ticket and auto-open a PM with the hacker, or (:x: 1) to mark as duplicate/irrelevant:",

    attachments: JSON.stringify([
      {
        fallback: `${data.user_name} asked: ${data.text}`,
        author_name: `${name} (${data.user_name})`,
        author_icon: image,
        text: data.text,
      }
    ])
  });
  logQuestion(mentorPost.ts, data.text, data.user_name);
  yield api.slackApi("reactions.add", {
    channel: mentorPost.channel,
    timestamp: mentorPost.ts,
    name: "raising_hand"
  });
  yield api.slackApi("reactions.add", {
    channel: mentorPost.channel,
    timestamp: mentorPost.ts,
    name: "x"
  });
});

var allTags = [];
tags.forEach(t => {
  allTags.push(t.name);
  allTags = allTags.concat(t.synonyms);
});
var tagify = (str) => {
  return str.replace(/([^\s]+)/g, (word) => {
    if (allTags.indexOf(word) !== -1) {
      return "#" + word;
    } else {
      return word;
    }
  });
};

var usernameCache = {};
var userIDCache = {};

var getUser = function*(info) {
  if (info.id && info.id in userIDCache) {
    return userIDCache[info.id];
  }
  if (info.username && info.username in usernameCache) {
    return usernameCache[info.username];
  }
  var members = (yield api.slackApi("users.list")).members;
  members.forEach((member) => {
    userIDCache[member.id] = member;
    usernameCache[member.name] = member;
  });
  if (info.id) {
    return userIDCache[info.id];
  }
  if (info.username) {
    return userIDCache[info.username];
  }
}

var deleted = {};

var onReactionAdded = function*(m) {
  if (m.user === api.selfId) return;
  if (m.reaction !== "raising_hand" && m.reaction !== "x") return;
  if (m.item.ts in deleted) return;
  deleted[m.item.ts] = true;
  var toDelete = (yield api.slackApi("groups.history", {
    channel: m.item.channel,
    latest: m.item.ts,
    oldest: m.item.ts,
    inclusive: 1
  })).messages[0];
  yield api.slackApi("chat.delete", {
    channel: m.item.channel,
    ts: m.item.ts,
    token: admin_token
  });
  if (m.reaction === "raising_hand") {
    yield createGroup(toDelete, m.user);
    logClaim(m.item.ts, yield getUser(m.user).name);
  } else {
    logDelete(m.item.ts, yield getUser(m.user).name);
  }
  delete deleted[m.item.ts];
};

var createGroup = function*(m, mentorId) {
  var attachment = m.attachments[0];
  var text = attachment.text;
  var menteeUsername = attachment.author_name.match(/\((.*)\)/)[1];
  var mentor = yield getUser({id: mentorID});
  var mentee = yield getUser({username: menteeUsername});
  var groups = (yield api.slackApi("mpim.list")).groups;
  var group = null;
  var existing = false;
  for (var i = 0; i < groups.length; i++) {
    if (groups[i].members.indexOf(mentor.id) !== -1 && groups[i].members.indexOf(mentee.id) !== -1) {
      group = groups[i];
      existing = true;
      break;
    }
  }
  if (mentor.id == mentee.id) {
    yield api.slackApi("chat.postMessage", {
      channel: mentor.id,
      username: "mentorbot",
      // as_user: true,
      text: `Glad you could answer your own question!`
    })
    return;
  }

  if (!group) {
    group = (yield api.slackApi("mpim.open", {
      users: [mentor.id, mentee.id].join(",")
    })).group;
  }

  var id = group.id;
  if (!existing) {
    yield api.slackApi("chat.postMessage", {
      channel: id,
      as_user: true,
      text: `(<!group>) Hey ${mentee.profile.first_name || mentee.name}, meet your mentor ${mentor.profile.first_name || mentor.name}! You're welcome to keep it digital here, but we encourage you to meet up and debug face to face! The question was:\n>${text.replace("\n", "\n>")}`
    })
  } else {
    yield api.slackApi("chat.postMessage", {
      channel: id,
      as_user: true,
      text: `<!group>, y'all have been matched again! This time the question was:\n>${text.replace("\n", "\n>")}`
    });
  }
};


var onChannelDelete = function*(m) {
  api.slackApi("chat.delete", {
    channel: m.channel,
    ts: m.ts,
    token: admin_token
  }, ["message_not_found"]).done();
};

var mentorGroupId = api.slackApi("groups.list")
.then(res => {
  var groups = res.groups;
  for (var i = 0; i < groups.length; i++) {
    var group = groups[i];
    if (group.name === mentor_group_name) {
      return group.id;
    }
  }
  throw new Error(`No group with name ${mentor_group_name} found!`);
});

api.on("message", function*(m) {
  if (m.type === "reaction_added" && m.item.channel === (yield mentorGroupId)) {
    yield onReactionAdded(m);
  }
  if (m.type === "message" &&
      m.subtype !== "message_deleted" &&
      m.channel === (yield mentorGroupId) &&
      m.user !== api.selfId) {
    yield onChannelDelete(m);
  }
});

var updateLeaderboard = function*(channel, answerer) {

}
