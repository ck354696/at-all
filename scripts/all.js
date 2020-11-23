"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var https = require("https");

// Bot configs read in from environment
var room_id = process.env.HUBOT_GROUPME_ROOM_ID;
var bot_id = process.env.HUBOT_GROUPME_BOT_ID;
var token = process.env.HUBOT_GROUPME_TOKEN;

if (!room_id || !bot_id || !token) {
  console.error("@all ERROR: Unable to read full environment.\n    Did you configure environment variables correctly?\n    - HUBOT_GROUPME_ROOM_ID\n    - HUBOT_GROUPME_BOT_ID\n    - HUBOT_GROUPME_TOKEN");
  process.exit(1);
}

var AllBot = function () {
  function AllBot(robot) {
    _classCallCheck(this, AllBot);

    this.robot = robot;
    this.blacklist = [];

    // Load the blacklist as soon as we can
    this.robot.brain.once("loaded", this.loadBlacklist.bind(this));
  }

  _createClass(AllBot, [{
    key: "saveBlacklist",
    value: function saveBlacklist() {
      console.log("Saving blacklist");
      this.robot.brain.set("blacklist", this.blacklist);
      this.robot.brain.save();
    }
  }, {
    key: "loadBlacklist",
    value: function loadBlacklist() {
      this.blacklist = this.robot.brain.get("blacklist");
      if (this.blacklist) console.log("Blacklist loaded successfully.");else console.warn("Failed to load blacklist.");
    }
  }, {
    key: "addToBlacklist",
    value: function addToBlacklist(item) {
      this.blacklist.push(item);
      this.saveBlacklist();
    }
  }, {
    key: "removeFromBlacklist",
    value: function removeFromBlacklist(item) {
      var index = this.blacklist.indexOf(item);
      if (index !== -1) {
        this.blacklist.splice(index, 1);
        this.saveBlacklist();
        console.log("Successfully removed " + item + " from blacklist.");
      } else {
        console.warn("Unable to find " + item + " in blacklist!");
      }
    }
  }, {
    key: "getUserByName",
    value: function getUserByName(_name) {
      var name = _name.trim();
      if (name[0] == "@") {
        name = name.slice(1);
      }
      var user = this.robot.brain.userForName(name);
      if (!user.user_id) return null;else return user;
    }
  }, {
    key: "getUserById",
    value: function getUserById(id) {
      var user = this.robot.brain.userForId(id);
      if (!user.user_id) return null;else return user;
    }
  }, {
    key: "respondToID",
    value: function respondToID(res, target) {
      // Get ID command
      console.log("Looking for user ID by name: " + target);
      var found = this.getUserByName(target);

      if (found) {
        var id = found.user_id;
        console.log("Found ID " + id + " by name " + target);
        res.send(target + ": " + id);
      } else {
        res.send("Could not find a user with the name " + target);
      }
    }
  }, {
    key: "respondToName",
    value: function respondToName(res, target) {
      console.log("Looking for user name by ID: " + target);
      var found = this.getUserById(target);

      if (found) {
        var name = found.name;
        console.log("Found name " + name + " by ID " + target);
        res.send(target + ": " + name);
      } else {
        res.send("Could not find a user with the ID " + target);
      }
    }
  }, {
    key: "respondToViewBlacklist",
    value: function respondToViewBlacklist(res) {
      var _this = this;

      // Raw blacklist
      if (res.match[1]) return res.send(JSON.stringify(this.blacklist));

      var blacklistNames = this.blacklist.map(function (user) {
        return _this.getUserById(user).name;
      });

      if (blacklistNames.length > 0) return res.send(blacklistNames.join(", "));else return res.send("There are currently no users blacklisted.");
    }
  }, {
    key: "respondToBlacklist",
    value: function respondToBlacklist(res, target) {
      var user = this.getUserByName(target);

      if (!user) return res.send("Could not find a user with the name " + target);

      console.log("Blacklisting " + target + ", " + user.user_id);
      this.addToBlacklist(user.user_id);
      res.send("Blacklisted " + target + " successfully.");
    }
  }, {
    key: "respondToWhitelist",
    value: function respondToWhitelist(res, target) {
      var user = this.getUserByName(target);

      if (!user) return res.send("Could not find a user with the name " + target);

      console.log("Whitelisting " + target + ", " + user.user_id);
      this.removeFromBlacklist(user.user_id);
      res.send("Whitelisted " + target + " successfully");
    }
  }, {
    key: "respondToAtAll",
    value: function respondToAtAll(res) {
      var _this2 = this;

      // Select the longer of the two options.
      // TODO: Maybe combine them?
      var text = res.match[0].length > res.match[1].length ? res.match[0] : res.match[1];

      // Default text if not long enough
      // TODO: Is this necessary? Can't we tag everyone on a 1 character message?
      // if (text.length < users.length)
      //   text = "Please check the GroupMe, everyone.";

      // The message for use in GroupMe API
      var message = {
        text: text,
        bot_id: bot_id,
        attachments: [{ loci: [], type: "mentions", user_ids: [] }]
      };

      // Add "mention" for each user
      var users = this.robot.brain.users();
      Object.keys(users).map(function (userID, index) {
        // Skip blacklisted users
        if (_this2.blacklist.indexOf(userID) !== -1) return;

        // TODO: Would [i, i] work?
        message.attachments[0].loci.push([index, index + 1]);
        message.attachments[0].user_ids.push(userID);
      });

      // Send the request
      var json = JSON.stringify(message);
      var groupmeAPIOptions = {
        agent: false,
        host: "api.groupme.com",
        path: "/v3/bots/post",
        port: 443,
        method: "POST",
        headers: {
          "Content-Length": json.length,
          "Content-Type": "application/json",
          "X-Access-Token": token
        }
      };
      var req = https.request(groupmeAPIOptions, function (response) {
        var data = "";
        response.on("data", function (chunk) {
          return data += chunk;
        });
        response.on("end", function () {
          return console.log("[GROUPME RESPONSE] " + response.statusCode + " " + data);
        });
      });
      req.end(json);
    }

    // Defines the main logic of the bot

  }, {
    key: "run",
    value: function run() {
      var _this3 = this;

      // Register listeners with hubot
      this.robot.hear(/get id (.+)/i, function (res) {
        return _this3.respondToID(res, res.match[1]);
      });
      this.robot.hear(/get name (.+)/i, function (res) {
        return _this3.respondToName(res, res.match[1]);
      });
      this.robot.hear(/view( raw)* blacklist/i, function (res) {
        return _this3.respondToViewBlacklist(res);
      });
      this.robot.hear(/blacklist (.+)/i, function (res) {
        return _this3.respondToBlacklist(res, res.match[1]);
      });
      this.robot.hear(/whitelist (.+)/i, function (res) {
        return _this3.respondToWhitelist(res, res.match[1]);
      });

      // Mention @all command
      this.robot.hear(/(.*)@all(.*)/i, function (res) {
        return _this3.respondToAtAll(res);
      });
    }
  }]);

  return AllBot;
}();

module.exports = function (robot) {
  var bot = new AllBot(robot);
  bot.run();
};