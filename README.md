
WhoisOnline
===========

WhoisOnline will be a prototype of an open and distributed 
chat and instant messaging system.  Easy as WhatsApp and 
distributed as IRC and XMPP.

Why yet another chat system?
----------------------------

Most chat and im systems are not distributed because 
they are run by a commercial companies. These companies
try to collect as many users as possible, and close all
connections to their competitors. The result is, that 
users have to register with different services to keep
contact with different groups of friends, and they have 
to trust these companies in regard of privacy and service
availability.

The power of the Internet was that it is based on protocols
and not on service providers. Think of email: everybody who
has a DNS Domain can run a mail server, and when you start your
mail server you are immediately part of the whole email 
network. Or http: everybody can setup a webserver and is
immediately reachable by alle users with a web browser.

WhoisOnline aims to be a standard to use the already existing
user@domain name space, and add chat services. If you know 
the email address of your chat partner, you can start a conversation
using this address if the domain owner runs a whoisonline 
compatible server. Just like email.

XMPP does that, whats wrong with XMPP?
--------------------------------------

 - XMPP comes from the aera of XML based protocols. I don't like most of them ;-)
 - On an XMPP network the client is part of the XMPP chain
   and messeage are delivered to the client. If a user has more clients,
   messages are usually not forwarded to all of them. There are
   extensions for that, but they are all not perfect.
 - The XMPP protocoll is usually running over TCP. But some firewalls
   force you to HTTP
 - XMPP needs a client. Current services have to be web base, at least optionally.

What are the advantages of WhoisOnline?
---------------------------------------

 - WhoisOnline is a network of servers. Every server is authorative for one
   or more DNS domains. 
 - Every WhoisOnline server is immediately part of the WhoisOnlineNetwork
   when you set the correct DNS entry.
 - The Server2Server protocol is mandatory. (S2S-PROTOCOL)
 - Everybody is welcome to use this WhoisOnline software, or change it, or
   even implement a totally new server.
 - This package provides a server and a web client.
 - You may also us the server and write a different client using the current
   client api (CLIENT-API).
 - The server must be reachable from the internet, if you like to be part
   of the WhoisOnline network.
 - The client api is base on pure HTTP, it should work through all
   possible NAT, NAT64, firewall, IDS systems and mobile operators currently 
   available.
 - The server can handle multiple connections from the same user from different
   clients. If you send a message from one client, it shows up on all other
   clients of this user immediately.

What's the current status?
--------------------------

This project is in early development state. The current
version is v0.4. The following features are working (or should
be working, and need testing):

 - Node Chat Server
 - Web UI
 - Login / Auto Registration
 - chat invitations
 - 1-to-1 chat 
 - Msg queueing for offline users
 - Multi session support 
 - Managing and showing online status
 - Minimal DB lib with saved state

Roadmap of coming features:

 - Group chats
 - Push notofications for chrome users
 - S2S protocol
 - Read status per user
 - ....


